import requests
from typing import Dict, Any, List, Optional
from cache_manager import get_memory

memory = get_memory()

OPENALEX_BASE = "https://api.openalex.org"

@memory.cache
def cached_fetch(url: str, params: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
    """
    Cached GET request for OpenAlex.
    """
    headers = {
        "User-Agent": "mailto:antigravity@example.com" # Placeholder, user should update or we use generic
    }
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"OpenAlex Request failed: {e}")
        return None

class OpenAlexClient:
    def __init__(self):
        pass

    def invert_abstract(self, inverted_index: Dict[str, List[int]]) -> Optional[str]:
        """
        Reconstruct abstract from inverted index.
        Format: { "word": [pos1, pos2], ... }
        """
        if not inverted_index:
            return None
            
        # Create a list of (position, word) tuples
        words = []
        for word, positions in inverted_index.items():
            for pos in positions:
                words.append((pos, word))
        
        # Sort by position
        words.sort(key=lambda x: x[0])
        
        # Join words
        return " ".join([w[1] for w in words])

    def _format_paper(self, work: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map OpenAlex Work object to our internal format.
        """
        paper_id = work.get("id", "").replace("https://api.openalex.org/works/", "") # Clean ID? or keep URL
        # Let's keep the full ID or short ID. 
        # S2 used IDs. OpenAlex default is URL (https://openalex.org/W...) usually. 
        # The API returns id as url.
        # Let's use the short ID (W...) for cleanliness if possible, but URL is fine too.
        # The prompt says: "Return the first match's ID and Title."
        
        # Extract abstract
        abstract = self.invert_abstract(work.get("abstract_inverted_index"))
        
        # Map referenced_works (list of URLs) to references list of objects
        # Our graph logic expects: references = [{"paperId": "...", ...}, ...]
        references = []
        for ref_url in work.get("referenced_works", []):
            # ref_url is like "https://openalex.org/W123..." or just ID?
            # API doc says referenced_works is list of IDs (URLs).
            ref_id = ref_url.replace("https://openalex.org/", "").replace("https://api.openalex.org/works/", "")
            references.append({"paperId": ref_id})
            
        return {
            "paperId": paper_id.replace("https://openalex.org/", "").replace("https://api.openalex.org/works/", ""),
            "title": work.get("title"),
            "year": work.get("publication_year"),
            "citationCount": work.get("cited_by_count"),
            "abstract": abstract,
            "authors": [], # Not strictly asked for but good to have. OpenAlex 'authorships' field.
            "references": references,
            "citations": [] # OpenAlex doesn't provide incoming list in this view
        }

    def search_paper(self, query: str) -> List[Dict[str, Any]]:
        url = f"{OPENALEX_BASE}/works"
        params = {
            "filter": f"title.search:{query}",
            "per-page": 5,
            "select": "id,title,publication_year,referenced_works,cited_by_count,abstract_inverted_index"
        }
        data = cached_fetch(url, params)
        if not data: return []
        
        results = data.get("results", [])
        return [self._format_paper(w) for w in results]

    def get_paper_details(self, paper_id: str) -> Optional[Dict[str, Any]]:
        # Handle if paper_id is not a URL
        # OpenAlex IDs are usually W123456. API accepts just the ID W...
        url = f"{OPENALEX_BASE}/works/{paper_id}"
        params = {
             "select": "id,title,publication_year,referenced_works,cited_by_count,abstract_inverted_index"
        }
        data = cached_fetch(url, params)
        if not data: return None
        return self._format_paper(data)

    def get_papers_batch(self, paper_ids: List[str]) -> List[Dict[str, Any]]:
        if not paper_ids: return []
        
        # OpenAlex `ids` filter usually works, but `openalex_id` with full URL is safer.
        # IDs are stored as W123, convert to https://openalex.org/W123
        full_ids = [f"https://openalex.org/{pid}" if not pid.startswith("http") else pid for pid in paper_ids]
        
        # Join with pipe
        ids_str = "|".join(full_ids)
        
        url = f"{OPENALEX_BASE}/works"
        # Using openalex_id filter
        params = {
            "filter": f"openalex_id:{ids_str}",
            "per-page": 50, # 200 is max, but safer to go lower if URL length is an issue
            "select": "id,title,publication_year,referenced_works,cited_by_count,abstract_inverted_index"
        }
        
        # Note: If URL is too long, we should split into chunks.
        # GET request limit is usually 2k-8k chars.
        # 50 IDs * ~30 chars = 1500 chars. Safe.
        
        data = cached_fetch(url, params)
        if not data: return []
        
        results = data.get("results", [])
        return [self._format_paper(w) for w in results]

open_alex_client = OpenAlexClient()
