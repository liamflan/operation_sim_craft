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
    # Improved chunking to better handle recipe object boundaries
    chunks = re.split(r'(?:export const \w+: NormalizedRecipe = \{|\{)\s*id:\s*[\'"]', content)
    
    for chunk in chunks[1:]:
        recipe = {}
        # Get ID
        id_match = re.search(r'^([a-zA-Z0-9_-]+)[\'"]', chunk)
        if not id_match: continue
        recipe_id = id_match.group(1)
        
        # Filter non-recipes (raw inputs, ingredient objects)
        if 'title:' not in chunk or 'suitableFor:' not in chunk:
            continue
        
        recipe['id'] = recipe_id
        
        # Get Title - Improved to handle nested quotes correctly and trim whitespace
        title_match = re.search(r'title:\s*([\'"])(.+?)\1(?=[,\n\r\s]+\w+:|\s*\})', chunk, re.DOTALL)
        if title_match:
            recipe['title'] = title_match.group(2).strip()
        else:
            title_match = re.search(r'title:\s*[\'"](.+?)[\'"]', chunk)
            recipe['title'] = title_match.group(1).strip() if title_match else 'Unknown'
        
        # Clean title: Remove excessive internal spaces or artifacts
        recipe['title'] = re.sub(r'\s+', ' ', recipe['title']).strip()
        
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
        sf_match = re.search(r'suitableFor:\s*\[(.*?)\]', chunk, re.DOTALL)
        if sf_match:
            suitable_for = [s.strip().strip("'").strip('"') for s in sf_match.group(1).split(',') if s.strip()]
            recipe['suitableFor'] = ', '.join(suitable_for)
        else:
            recipe['suitableFor'] = 'unknown'
            
        # Get Key Ingredients - Fixed regex to handle empty brackets []
        ing_match = re.search(r'ingredients:\s*\[(.*?)\]', chunk, re.DOTALL)
        ing_names = []
        if ing_match and ing_match.group(1).strip():
            ing_names = re.findall(r'name:\s*[\'"](.+?)[\'"]', ing_match.group(1))
        
        # Fallback to ingredientTags
        if not ing_names:
            it_match = re.search(r'ingredientTags:\s*\[(.*?)\]', chunk, re.DOTALL)
            if it_match and it_match.group(1).strip():
                ing_names = [s.strip().strip("'").strip('"') for s in it_match.group(1).split(',') if s.strip()]
        
        # If still empty, use title as basis but don't just repeat it 1:1 if possible
        if not ing_names:
            recipe['keyIngredients'] = recipe['title']
        else:
            recipe['keyIngredients'] = ', '.join(ing_names[:5])
            
        # Get Description
        desc_match = re.search(r'description:\s*[\'"](.+?)[\'"]', chunk, re.DOTALL)
        recipe['description'] = desc_match.group(1) if desc_match else ''
            
        recipes.append(recipe)
        
    return recipes

def generate_visual_description(recipe):
    title = recipe['title']
    cuisine = recipe['cuisineId'].replace('_', ' ')
    archetype = recipe['archetype'].replace('_', ' ').lower()
    ingredients = recipe['keyIngredients']
    suitable = recipe['suitableFor'].lower()
    
    # Plating logic
    context = "plated as a gourmet meal"
    if 'breakfast' in suitable:
        context = "in a breakfast bowl"
    elif 'lunch' in suitable:
        context = "as a fresh lunch plate"
    elif 'dinner' in suitable:
        context = "plated as a hearty evening dinner"

    # Keywords for specific dishes to avoid generic "Professional food photography"
    style_keywords = "vibrant colors, clean composition, natural overhead lighting, appetizing texture."
    
    if "salmon" in title.lower() or "fish" in title.lower() or "seabass" in title.lower():
        style_keywords = "seared texture, lemon garnish, fresh herbs, glistening sauce."
    elif "pasta" in title.lower() or "linguine" in title.lower() or "shells" in title.lower():
        style_keywords = "al dente texture, rich sauce, sprinkled parmesan, fresh basil leaves."
    elif "stew" in title.lower() or "chili" in title.lower() or "curry" in title.lower():
        style_keywords = "rich steam, deep colors, swirling cream or garnish, rustic bowl."
    elif "toast" in title.lower() or "bread" in title.lower():
        style_keywords = "crispy golden edges, layered toppings, microgreens, rustic wood background."

    desc = f"Gourmet food photography of {title}, a {cuisine if cuisine != 'unknown' else 'delicious'} {archetype}. "
    desc += f"Highly detailed shot featuring {ingredients}. "
    desc += f"The dish is {context}, {style_keywords} "
    desc += "Professional commercial styling, 8k resolution, elegant presentation."
    
    return desc

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
            
            id_part = url.split('/')[-1].split('?')[0]
            if id_part.startswith('photo-'):
                has_keyword = any(k in id_part.lower() for k in keywords)
                if keywords and not has_keyword:
                    status = 'suspect'
            else:
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
            'visualDescription': generate_visual_description(r),
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
    
    # Output JSON & CSV (Full Audit)
    # Full audit treats 'suspect' as 'review-needed' conceptually, but we keep the status name for technical consistency
    with open('recipe_image_audit_full.json', 'w', encoding='utf-8') as f:
        json.dump(final_audit, f, indent=2)
        
    headers = ['recipeId', 'title', 'cuisineId', 'archetype', 'suitableFor', 'keyIngredients', 'currentImageUrl', 'imageStatus', 'visualDescription', 'targetFilename']
    with open('recipe_image_audit_full.csv', 'w', encoding='utf-8') as f:
        f.write(','.join(headers) + '\n')
        for r in final_audit:
            row = [f'"{str(r[h]).replace('"', '""')}"' for h in headers]
            f.write(','.join(row) + '\n')
            
    # Output First-Pass Generation Queue (Only Missing + Placeholder)
    queue = [r for r in final_audit if r['imageStatus'] in ['missing', 'placeholder']]
    with open('recipe_image_generation_queue.json', 'w', encoding='utf-8') as f:
        json.dump(queue, f, indent=2)
    
    with open('recipe_image_generation_queue.csv', 'w', encoding='utf-8') as f:
        f.write(','.join(headers) + '\n')
        for r in queue:
            row = [f'"{str(r[h]).replace('"', '""')}"' for h in headers]
            f.write(','.join(row) + '\n')
            
    print(f"Audit Complete! Total Unique Recipes: {len(final_audit)}")
    print(f"- Good: {len([r for r in final_audit if r['imageStatus'] == 'good'])}")
    print(f"- Missing: {len([r for r in final_audit if r['imageStatus'] == 'missing'])}")
    print(f"- Placeholder: {len([r for r in final_audit if r['imageStatus'] == 'placeholder'])}")
    print(f"- Suspect (Review Needed): {len([r for r in final_audit if r['imageStatus'] == 'suspect'])}")
    print(f"\nFirst-Pass Generation Queue: {len(queue)} items (written to recipe_image_generation_queue.csv)")

if __name__ == '__main__':
    main()
