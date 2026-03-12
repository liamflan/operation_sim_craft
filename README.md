# Provision - Taste-Led Planning 🥑

Provision is a premium, intelligence-first meal planning system designed to bridge the gap between fixed recipe libraries and infinite AI generation. It prioritizes flavor alignment, budget control, and macro precision through a rigorous, multi-layered planning engine.

## 🏗️ Hybrid Architecture

At the heart of Provision is a strict 4-layer data model that ensures consistency across curated, imported, and AI-generated content:

1.  **Raw Input Layer**: Handles URL imports, raw text, and Gemini-generated payloads with full actor provenance (who requested it and why).
2.  **Normalized Canonical Schema**: A shared internal format for all recipes, including confidence scores for macros and costs.
3.  **Planner Candidate Objects**: Specialized scoring entities that evaluate recipes across 7 dimensions (Slot Fit, Macros, Budget, Taste, Variety, Pantry, and Leftovers).
4.  **Planned Meal Assignments**: The final schedule, featuring immutable **Decision Snapshots** that preserve the "why" behind every meal choice for future diagnostics.

## ✨ Key Features

-   **Deterministic Planner Engine**: Implements hard-eligibility guardrails for protein minimums, budget limits, repeat caps, and slot suitability.
-   **Intelligent Rescue Flow**: A tiered recovery system that handles pool collapses by automatically relaxing constraints or triggering Gemini for custom "Budget Rescue" generations.
-   **Provision Insights**: Real-time feedback on *why* a meal was chosen, highlighting key benefits like "Budget Fit" or "High Protein."
-   **Planner Sandbox**: A dedicated developer environment for auditing the engine's internal scoring and diagnostics in real-time.
-   **Pantry & Shopping List Aware**: Built-in inventory tracking that influences planner scoring based on ingredients you already own.

## 🛠️ Tech Stack

-   **Frontend**: React Native with Expo (Tabs Router)
-   **Styling**: NativeWind (Tailwind CSS for Native)
-   **Intelligence**: Gemini AI Integration (Hybrid Model)
-   **Architecture**: TypeScript-first, deterministic core logic with comprehensive Jest coverage.

## 🚀 Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start the development server**:
    ```bash
    npm run start
    ```
3.  **Access the Sandbox**:
    Navigate to the "Planner Sandbox" via the side panel (Desktop) to view engine diagnostics.

## 🧪 Testing

The planner core is backed by a 100% deterministic test suite:
```bash
npx jest data/planner
```

---

*Provision: Better taste, tighter budgets, smarter plans.*
