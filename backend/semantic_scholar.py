import requests
import time
from typing import Dict, Any, List, Optional
from cache_manager import get_memory

S2_API_BASE = "https://api.semanticscholar.org/graph/v1"

memory = get_memory()

@memory.cache
def cached_fetch(url: str, params: Dict[str, Any] = None, headers: Dict[str, str] = None, method: str = "GET", json_body: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
    """
    Standalone cached function for HTTP requests (GET and POST).
    """
    max_retries = 5
    backoff_factor = 2
    
    for attempt in range(max_retries):
        try:
            if method.upper() == "POST":
                response = requests.post(url, headers=headers, params=params, json=json_body)
            else:
                response = requests.get(url, headers=headers, params=params)
            
            if response.status_code == 429:
                wait_time = backoff_factor ** attempt
                print(f"Rate limited. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            
            if response.status_code >= 500:
                time.sleep(1)
                continue

            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            if attempt == max_retries - 1:
                return None
            time.sleep(1)
            
    return None

class SemanticScholarAPI:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.headers = {}
        if self.api_key:
            self.headers["x-api-key"] = self.api_key

    def _make_request(self, url: str, params: Dict[str, Any] = None, method: str = "GET", json_body: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        # Delegate to cached function
        # Convert dicts to tuple of items if needed for hashing? 
        # Joblib can usually handle dicts.
        return cached_fetch(url, params, self.headers, method, json_body)

    def search_paper(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Search for papers by title or keyword.
        """
        url = f"{S2_API_BASE}/paper/search"
        params = {
            "query": query,
            "limit": limit,
            "fields": "paperId,title,year,citationCount,abstract,authors"
        }
        data = self._make_request(url, params)
        return data.get("data", []) if data else []

    def get_paper_details(self, paper_id: str) -> Optional[Dict[str, Any]]:
        """
        Get details for a specific paper, including citations and references.
        """
        url = f"{S2_API_BASE}/paper/{paper_id}"
        # We need citations and references for the graph
        fields = "paperId,title,year,citationCount,abstract,authors,citations.paperId,citations.title,citations.year,citations.abstract,references.paperId,references.title,references.year,references.abstract"
        params = {
            "fields": fields
        }
        return self._make_request(url, params)

    def get_papers_batch(self, paper_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Fetch details for multiple papers in a single batch request.
        """
        if not paper_ids:
            return []
            
        url = f"{S2_API_BASE}/paper/batch"
        # For batch, we need references and citations to compute similarity
        fields = "paperId,title,year,citationCount,abstract,authors,citations.paperId,citations.title,citations.year,citations.abstract,references.paperId,references.title,references.year,references.abstract"
        params = {"fields": fields}
        
        # S2 batch API uses POST
        # We need to handle caching for POST? joblib might not like POST body in *args easily if we used a wrapper.
        # But we delegate to `_make_request`. 
        # `_make_request` currently does GET. We need to update it or make a new one.
        
        # Let's update `_make_request` to support 'method' and 'json_body'.
        
        return self._make_request(url, params=params, method="POST", json_body={"ids": paper_ids}) or []

# Global instance
s2_client = SemanticScholarAPI()
