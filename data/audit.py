import re
import json

def get_counts(text):
    data = {"diet": {"Omnivore": 0, "Pescatarian": 0, "Vegetarian": 0, "Vegan": 0}, 
            "slots": {"breakfast": 0, "lunch": 0, "dinner": 0, "snack_am": 0, "snack_pm": 0, "dessert": 0},
            "archetype": {},
            "budgetBands": {"under2": 0, "under4": 0, "over4": 0},
            "calorieBands": {"under400": 0, "under600": 0, "over600": 0},
            "proteinBands": {"under20": 0, "under35": 0, "over35": 0},
            "images": {"has_unsplash": 0, "has_internal": 0}}
    
    recipes_blocks = text.split('id: "')
    for block in recipes_blocks[1:]:
        # diets
        if "Vegan" in block: data["diet"]["Vegan"] += 1
        elif "Vegetarian" in block: data["diet"]["Vegetarian"] += 1
        elif "Pescatarian" in block: data["diet"]["Pescatarian"] += 1
        else: data["diet"]["Omnivore"] += 1
        
        # slots
        slots = re.findall(r"suitableFor:\s*\[([^\]]+)\]", block)
        if slots:
            for s in ["breakfast", "lunch", "dinner", "snack_am", "snack_pm", "dessert"]:
                if s in slots[0]: data["slots"][s] += 1
                
        # archetypes
        arch = re.search(r"archetype:\s*'([^']+)'", block)
        if arch:
            val = arch.group(1)
            data["archetype"][val] = data["archetype"].get(val, 0) + 1
            
        # budget
        # Look for estimatedCostPerServingGBP or costPerServingGBP
        cost_match = re.search(r"(?:estimatedCostPerServingGBP|costPerServingGBP):\s*([\d\.]+)", block)
        if cost_match:
            c = float(cost_match.group(1))
            if c < 2.0: data["budgetBands"]["under2"] += 1
            elif c <= 4.0: data["budgetBands"]["under4"] += 1
            else: data["budgetBands"]["over4"] += 1
            
        # cals and protein
        macros = re.search(r"(?:macros:|macrosTotal:|macrosPerServing:)\s*\{.*?calories:\s*([\d\.]+).*?protein:\s*([\d\.]+)", block)
        # Note: if it's macrosTotal, we need to divide by servings sometimes, but actually for seed macros is macrosPerServing equivalent
        if macros:
            cal = float(macros.group(1))
            pro = float(macros.group(2))
            
            # for fixtures, macrosPerServing is used
            per_serving_match = re.search(r"macrosPerServing:\s*\{.*?calories:\s*([\d\.]+).*?protein:\s*([\d\.]+)", block)
            if per_serving_match:
                cal = float(per_serving_match.group(1))
                pro = float(per_serving_match.group(2))
                
            if cal < 400: data["calorieBands"]["under400"] += 1
            elif cal <= 600: data["calorieBands"]["under600"] += 1
            else: data["calorieBands"]["over600"] += 1
            
            if pro < 20: data["proteinBands"]["under20"] += 1
            elif pro <= 35: data["proteinBands"]["under35"] += 1
            else: data["proteinBands"]["over35"] += 1
            
        # images
        if "unsplash.com" in block: data["images"]["has_unsplash"] += 1
        if "assets/images" in block: data["images"]["has_internal"] += 1
            
    return data

with open("seed.ts", "r") as f: seed_data = f.read()
with open("planner/plannerFixtures.ts", "r") as f: p_data = f.read()

s_res = get_counts(seed_data)
p_res = get_counts(p_data)

final = {"diet": {}, "slots": {}, "archetype": {}, "budgetBands": {}, "calorieBands": {}, "proteinBands": {}, "images": {}}
for k in final.keys():
    for sub_k in s_res[k].keys():
        final[k][sub_k] = s_res[k].get(sub_k, 0) + p_res[k].get(sub_k, 0)

final["total"] = final["diet"]["Vegan"] + final["diet"]["Vegetarian"] + final["diet"]["Pescatarian"] + final["diet"]["Omnivore"]

print(json.dumps(final, indent=2))
