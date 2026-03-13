import re
import json
import os

FILES = [
    'data/seed.ts',
    'data/planner/plannerFixtures.ts',
    'data/planner/wave1Fixtures.ts',
    'data/planner/wave2Fixtures.ts',
    'data/planner/wave3Fixtures.ts'
]

KNOWN_PLACEHOLDERS = [
    'photo-1473093295043-cdd812d0e601',
    'photo-1543339308-43e59d6b73a6',
    'photo-1512621776951-a57141f2eefd',
    'photo-1540189549336-e6e99c3679fe',
    'photo-1546069901-ba9599a7e63c',
]

def extract_recipes(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    recipes = []
    # Find segments that likely start a recipe object
    chunks = re.split(r'(?:export const \w+: NormalizedRecipe = \{|\{)\s*id:\s*[\'"]', content)
    
    for chunk in chunks[1:]:
        recipe = {}
        # Get ID
        id_match = re.search(r'^([a-zA-Z0-9_-]+)[\'"]', chunk)
        if not id_match: continue
        recipe_id = id_match.group(1)
        
        # Filter non-recipes (raw inputs, ingredients)
        if 'title:' not in chunk or 'suitableFor:' not in chunk:
            continue
        
        recipe['id'] = recipe_id
        
        # Get Title
        title_match = re.search(r'title:\s*[\'"](.+?)[\'"]', chunk)
        recipe['title'] = title_match.group(1) if title_match else 'Unknown'
        
        # Get Image URL
        image_match = re.search(r'imageUrl:\s*(?:getRecipeImage\([^,]+,\s*)?[\'"](.+?)[\'"]', chunk)
        recipe['imageUrl'] = image_match.group(1) if image_match else ''
        
        # Get CuisineId
        cuisine_match = re.search(r'cuisineId:\s*[\'"](.+?)[\'"]', chunk)
        recipe['cuisineId'] = cuisine_match.group(1) if cuisine_match else 'unknown'
        
        # Get Archetype
        archetype_match = re.search(r'archetype:\s*[\'"]?([a-zA-Z0-9_-]+)[\'"]?', chunk)
        recipe['archetype'] = archetype_match.group(1) if archetype_match else 'Staple'
        
        # Get SuitableFor
        sf_match = re.search(r'suitableFor:\s*\[(.+?)\]', chunk, re.DOTALL)
        if sf_match:
            suitable_for = [s.strip().strip("'").strip('"') for s in sf_match.group(1).split(',')]
            recipe['suitableFor'] = ', '.join(suitable_for)
        else:
            recipe['suitableFor'] = 'unknown'
            
        # Get Key Ingredients
        ing_match = re.search(r'ingredients:\s*\[(.+?)\]', chunk, re.DOTALL)
        if ing_match:
            ing_names = re.findall(r'name:\s*[\'"](.+?)[\'"]', ing_match.group(1))
            recipe['keyIngredients'] = ', '.join(ing_names[:3]) if ing_names else recipe['title']
        else:
            recipe['keyIngredients'] = recipe['title']
            
        recipes.append(recipe)
        
    return recipes

def audit(recipes):
    audit_data = []
    for r in recipes:
        url = r['imageUrl']
        status = 'good'
        
        if not url:
            status = 'missing'
        elif any(p in url for p in KNOWN_PLACEHOLDERS):
            status = 'placeholder'
        elif 'unsplash.com' in url:
            title_lower = r['title'].lower()
            url_lower = url.lower()
            keywords = [w for w in re.sub(r'[^a-z ]', '', title_lower).split() if len(w) > 3]
            
            # Identify Unsplash ID part
            id_part = url.split('/')[-1].split('?')[0]
            
            if id_part.startswith('photo-'):
                # Long photo IDs should ideally contain keywords
                has_keyword = any(k in id_part.lower() for k in keywords)
                if keywords and not has_keyword:
                    status = 'suspect'
            else:
                # Short hash IDs are likely curated fixtures
                status = 'good'
        
        row = {
            'recipeId': r['id'],
            'title': r['title'],
            'cuisineId': r['cuisineId'],
            'archetype': r['archetype'],
            'suitableFor': r['suitableFor'],
            'keyIngredients': r['keyIngredients'],
            'currentImageUrl': url,
            'imageStatus': status,
            'visualDescription': f"Professional gourmet food photography of {r['title']}, featuring {r['keyIngredients']}. Natural lighting, overhead shot.",
            'targetFilename': f"recipe_{r['id']}.webp"
        }
        audit_data.append(row)
    return audit_data

def main():
    root = 'c:\\Users\\liamf\\.gemini\\antigravity\\operation_sim_craft'
    all_recipes = []
    for f in FILES:
        path = os.path.join(root, f.replace('/', os.sep))
        if os.path.exists(path):
            all_recipes.extend(extract_recipes(path))
    
    audit_results = audit(all_recipes)
    
    # Deduplicate by recipeId
    seen = set()
    final_audit = []
    for r in audit_results:
        if r['recipeId'] not in seen:
            final_audit.append(r)
            seen.add(r['recipeId'])
    
    # Output JSON & CSV
    with open('recipe_image_audit_full.json', 'w', encoding='utf-8') as f:
        json.dump(final_audit, f, indent=2)
        
    headers = ['recipeId', 'title', 'cuisineId', 'archetype', 'suitableFor', 'keyIngredients', 'currentImageUrl', 'imageStatus', 'visualDescription', 'targetFilename']
    with open('recipe_image_audit_full.csv', 'w', encoding='utf-8') as f:
        f.write(','.join(headers) + '\n')
        for r in final_audit:
            row = [f'"{str(r[h]).replace('"', '""')}"' for h in headers]
            f.write(','.join(row) + '\n')
            
    queue = [r for r in final_audit if r['imageStatus'] in ['missing', 'placeholder', 'suspect']]
    with open('recipe_image_generation_queue.json', 'w', encoding='utf-8') as f:
        json.dump(queue, f, indent=2)
    
    with open('recipe_image_generation_queue.csv', 'w', encoding='utf-8') as f:
        f.write(','.join(headers) + '\n')
        for r in queue:
            row = [f'"{str(r[h]).replace('"', '""')}"' for h in headers]
            f.write(','.join(row) + '\n')
            
    print(f"Audit Complete! Total Recipes: {len(final_audit)}")
    print(f"- Good: {len([r for r in final_audit if r['imageStatus'] == 'good'])}")
    print(f"- Missing: {len([r for r in final_audit if r['imageStatus'] == 'missing'])}")
    print(f"- Placeholder: {len([r for r in final_audit if r['imageStatus'] == 'placeholder'])}")
    print(f"- Suspect: {len([r for r in final_audit if r['imageStatus'] == 'suspect'])}")
    
    # Print Markown table for the user
    print("\n### Audit Overview")
    print("| Status | Count |")
    print("| :--- | :--- |")
    print(f"| Good | {len([r for r in final_audit if r['imageStatus'] == 'good'])} |")
    print(f"| Missing | {len([r for r in final_audit if r['imageStatus'] == 'missing'])} |")
    print(f"| Placeholder | {len([r for r in final_audit if r['imageStatus'] == 'placeholder'])} |")
    print(f"| Suspect | {len([r for r in final_audit if r['imageStatus'] == 'suspect'])} |")

if __name__ == '__main__':
    main()

def main():
    root = 'c:\\Users\\liamf\\.gemini\\antigravity\\operation_sim_craft'
    all_recipes = []
    for f in FILES:
        path = os.path.join(root, f.replace('/', os.sep))
        if os.path.exists(path):
            all_recipes.extend(extract_recipes(path))
    
    audit_results = audit(all_recipes)
    
    # Deduplicate by recipeId
    seen = set()
    final_audit = []
    for r in audit_results:
        if r['recipeId'] not in seen:
            final_audit.append(r)
            seen.add(r['recipeId'])
    
    # Output JSON
    with open('recipe_image_audit_full.json', 'w', encoding='utf-8') as f:
        json.dump(final_audit, f, indent=2)
        
    # Output CSV
    headers = ['recipeId', 'title', 'cuisineId', 'archetype', 'suitableFor', 'keyIngredients', 'currentImageUrl', 'imageStatus', 'visualDescription', 'targetFilename']
    with open('recipe_image_audit_full.csv', 'w', encoding='utf-8') as f:
        f.write(','.join(headers) + '\n')
        for r in final_audit:
            row = [f'"{str(r[h]).replace('"', '""')}"' for h in headers]
            f.write(','.join(row) + '\n')
            
    # Output Queue
    queue = [r for r in final_audit if r['imageStatus'] in ['missing', 'placeholder', 'suspect']]
    with open('recipe_image_generation_queue.json', 'w', encoding='utf-8') as f:
        json.dump(queue, f, indent=2)
    
    with open('recipe_image_generation_queue.csv', 'w', encoding='utf-8') as f:
        f.write(','.join(headers) + '\n')
        for r in queue:
            row = [f'"{str(r[h]).replace('"', '""')}"' for h in headers]
            f.write(','.join(row) + '\n')
            
    print(f"Audit Complete! Total: {len(final_audit)}, Queue: {len(queue)}")
    
    # Print table
    print("| recipeId | title | status |")
    print("| --- | --- | --- |")
    for r in final_audit[:20]: # Show first 20
        print(f"| {r['recipeId']} | {r['title']} | {r['imageStatus']} |")

if __name__ == '__main__':
    main()
