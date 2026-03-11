import re
import json

def validate_wave1():
    with open("planner/wave1Fixtures.ts", "r") as f:
        content = f.read()

    recipes = content.split("export const ")[1:]
    results = []
    
    for r in recipes:
        name_match = re.match(r"(\w+): NormalizedRecipe", r)
        if not name_match: continue
        name = name_match.group(1)
        
        # Check native Phase 21 fields
        has_active = "activePrepMinutes:" in r
        has_total = "totalMinutes:" in r
        has_complexity = "complexityScore:" in r
        
        # Check core metadata
        has_slot = "suitableFor:" in r
        has_cost = "estimatedCostTotalGBP:" in r
        has_macros = "macrosTotal:" in r
        
        # Time constraints
        active_match = re.search(r"activePrepMinutes:\s*(\d+)", r)
        total_match = re.search(r"totalMinutes:\s*(\d+)", r)
        
        valid_time = True
        if active_match and total_match:
            valid_time = int(active_match.group(1)) <= int(total_match.group(1))
            
        # Complexity bounds
        comp_match = re.search(r"complexityScore:\s*([-]?\d+)", r)
        valid_comp = True
        if comp_match:
            c = int(comp_match.group(1))
            valid_comp = 1 <= c <= 5
        
        # Image
        has_image = "imageUrl:" in r
        
        # Diet tags
        is_vegan = "'Vegan'" in r
        is_veg = "'Vegetarian'" in r
        is_pesc = "'Pescatarian'" in r
        is_omni = "'Omnivore'" in r or (not is_vegan and not is_veg and not is_pesc)
        diet = "Vegan" if is_vegan else "Vegetarian" if is_veg else "Pescatarian" if is_pesc else "Omnivore"
            
        results.append({
            "Recipe Name": name,
            "Diet": diet,
            "Native Phase 21?": has_active and has_total and has_complexity,
            "Uses Legacy Fallbacks?": "prepTimeMinutes:" in r,
            "Valid Time Constraints?": valid_time,
            "Valid Complexity Bounds?": valid_comp,
            "Has Image?": has_image,
            "Has Core Metadata?": has_slot and has_cost and has_macros
        })
        
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    validate_wave1()
