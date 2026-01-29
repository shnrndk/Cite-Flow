# ResearchGraph

**ResearchGraph** is an interactive visualization tool designed to help researchers explore relationships between academic papers. It constructs a dynamic citation network using data from [OpenAlex](https://openalex.org/), visualizing connections based on direct citations and bibliographic coupling.

## Features

-   **Interactive Visualization**: Explore citations and references in a force-directed graph (powered by React Flow).
-   **Dynamic Layout**: Graph automatically expands or contracts to fit your screen size.
-   **AI-Powered Analysis**: Explain *why* two papers are related using LLM summarization.
-   **Similarity Scoring**: Edges are weighted by bibliographic coupling strength; filter weak connections with a slider.
-   **Seed-Centric Exploration**: Start with a "Seed" paper and explore its 1-hop neighborhood.

## Getting Started

### Prerequisites

-   Python 3.9+
-   Node.js 16+
-   OpenAI API Key (for AI Analysis)

### Backend

1.  Navigate to `backend/`:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Set up environment variables (`.env`):
    ```bash
    OPENAI_API_KEY=your_key_here
    ```
5.  Run the server:
    ```bash
    python main.py
    ```

### Frontend

1.  Navigate to `frontend/`:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

## Usage

1.  Enter a paper title (e.g., "Attention Is All You Need") in the search bar.
2.  Click the search icon.
3.  Explore the generated graph. Click nodes to see details or expand the graph.
4.  Use the slider at the top right to filter out weak similarity connections.
