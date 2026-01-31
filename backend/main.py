from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from openai import OpenAI
# from semantic_scholar import s2_client
from open_alex import open_alex_client as data_client
from graph_logic import build_network_graph

from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

app = FastAPI(title="ResearchGraph API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "ResearchGraph Backend is running"}

@app.get("/search")
async def search_paper_endpoint(query: str):
    results = data_client.search_paper(query)
    return {"results": results}

@app.get("/build_graph")
async def build_graph_endpoint(paper_id: str, width: int = 1000, height: int = 1000):
    # 1. Fetch seed paper details (references/citations included)
    seed_paper = data_client.get_paper_details(paper_id)
    if not seed_paper:
        raise HTTPException(status_code=404, detail="Paper not found")
        
    # 2. Identify 1-hop neighborhood.
    references = seed_paper.get("references", [])[:20] 
    citations = seed_paper.get("citations", [])[:20]   
    
    neighborhood_ids = [p["paperId"] for p in references if p.get("paperId")] + \
                       [p["paperId"] for p in citations if p.get("paperId")]
    
    # Remove duplicates
    neighborhood_ids = list(set(neighborhood_ids))
    
    # Batch fetch details
    try:
        full_neighborhood = data_client.get_papers_batch(neighborhood_ids)
        # Filter out None results
        full_neighborhood = [p for p in full_neighborhood if p]
                
        # 3. Build Graph with dynamic layout dimensions
        graph_data = build_network_graph(seed_paper, full_neighborhood, width, height)
        
        return graph_data
    except Exception as e:
        print(f"Error building graph: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class SummarizeRequest(BaseModel):
    source_abstract: str
    target_abstract: str

@app.post("/summarize_connection")
async def summarize_connection_endpoint(request: SummarizeRequest):
    if not client.api_key:
        return {"summary": "OpenAI API Key not found. Please set OPENAI_API_KEY environment variable."}
        
    prompt = f"""
    Analyze the relationship between the following two research paper abstracts.
    
    Paper A Abstract:
    {request.source_abstract}
    
    Paper B Abstract:
    {request.target_abstract}
    
    Explain specifically why Paper B is related to Paper A. Does it refute, extend, or use the methodology? be concise.
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150
        )
        return {"summary": response.choices[0].message.content}
    except Exception as e:
        print(f"LLM Error: {e}")
        return {"summary": "Failed to generate summary due to an error."}

class ExplainAbstractRequest(BaseModel):
    abstract: str

@app.post("/explain_abstract")
async def explain_abstract_endpoint(request: ExplainAbstractRequest):
    if not client.api_key:
        return {"explanation": "OpenAI API Key not found."}
        
    prompt = f"""
    Explain the following research paper abstract in a clear, structured way for a general audience.
    
    Structure your response as follows:
    - **One-sentence Summary**: A high-level overview.
    - **Key Contributions**: Use bullet points to list the main findings or methods.
    - **Impact**: Briefly explain why this matters.

    Abstract:
    {request.abstract}
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600
        )
        return {"explanation": response.choices[0].message.content}
    except Exception as e:
        print(f"LLM Error: {e}")
        return {"explanation": "Failed to generate explanation."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
