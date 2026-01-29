import networkx as nx
from typing import Dict, Any, List, Set, Tuple

def build_network_graph(seed_paper_details: Dict[str, Any], neighborhood_papers: List[Dict[str, Any]], width: int = 1000, height: int = 1000) -> Dict[str, Any]:
    G = nx.Graph()
    
    seed_id = seed_paper_details.get("paperId")
    
    # 1. Add Nodes
    add_node(G, seed_paper_details, is_seed=True)
    for paper in neighborhood_papers:
        if not paper.get("paperId"): continue
        add_node(G, paper)

    # =========================================================
    # FIX PART 1: ADD BASE LAYER (Direct Connections)
    # =========================================================
    # We must connect the Seed to the papers we found. 
    # Otherwise, they float in void if they don't share enough references.
    
    # Collect all neighborhood IDs for quick lookup
    neighborhood_ids = set(p["paperId"] for p in neighborhood_papers if p.get("paperId"))

    # Connect Seed -> Neighbors (if Seed cites them)
    for ref in seed_paper_details.get("references", []):
        ref_id = ref.get("paperId")
        if ref_id in neighborhood_ids:
            G.add_edge(seed_id, ref_id, weight=1.0, type="citation")

    # Connect Neighbors -> Seed (if they cite Seed)
    # Note: This depends on if your API response included 'citations' for the seed
    for cit in seed_paper_details.get("citations", []):
        cit_id = cit.get("paperId")
        if cit_id in neighborhood_ids:
            G.add_edge(seed_id, cit_id, weight=1.0, type="citation")

    # If the API didn't give us explicit citation links but we KNOW they are neighbors:
    # Force connection for the visualization (Optional but recommended for UI)
    if G.number_of_edges() == 0:
         for p_id in neighborhood_ids:
             G.add_edge(seed_id, p_id, weight=0.5, type="implied")

    # =========================================================
    # PART 2: SIMILARITY LAYER (Bibliographic Coupling)
    # =========================================================
    nodes = list(G.nodes(data=True))
    
    # Map paperId -> Set of Reference IDs
    paper_references: Dict[str, Set[str]] = {}
    for pid, data in nodes:
        # DATA CHECK: If 'references' is None/Empty, Jaccard will always be 0.
        refs = data.get("references", [])
        ref_ids = set()
        if refs:
            for r in refs:
                if r.get("paperId"):
                    ref_ids.add(r["paperId"])
        paper_references[pid] = ref_ids

    # Iterate pairs
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            p1_id, p1_data = nodes[i]
            p2_id, p2_data = nodes[j]

            # Skip if it's the Seed (we already handled Seed connections above)
            # Or keep it if you want to see if Seed is *similar* to neighbors beyond direct citation
            
            refs1 = paper_references.get(p1_id, set())
            refs2 = paper_references.get(p2_id, set())
            
            # DEBUG: Print if sets are empty (helps verify if API fetched references)
            # if not refs1 or not refs2: print(f"Warning: No refs for {p1_id} or {p2_id}")

            sim_score = calculate_jaccard_similarity(refs1, refs2)
            
            # LOWER THRESHOLD: 0.1 is actually quite high for papers. 
            # Try 0.05 or just checking for > 1 shared reference
            if sim_score > 0.05: 
                # Check if edge exists (from citation layer)
                if G.has_edge(p1_id, p2_id):
                    # Reinforce existing edge
                    G[p1_id][p2_id]['weight'] += sim_score
                    G[p1_id][p2_id]['type'] = "strong_citation"
                else:
                    G.add_edge(p1_id, p2_id, weight=sim_score, type="similarity")

    return graph_to_react_flow(G, width, height)

def add_node(G: nx.Graph, paper: Dict[str, Any], is_seed: bool = False):
    """
    Helper to add a node with relevant attributes.
    """
    if not paper.get("paperId"): return
    
    # Extract year safely
    year = paper.get("year")
    title = paper.get("title", "Untitled")
    citation_count = paper.get("citationCount", 0)
    
    G.add_node(paper["paperId"], 
        label=title, 
        year=year, 
        citationCount=citation_count,
        isSeed=is_seed,
        references=paper.get("references", []),
        citations=paper.get("citations", []),
        abstract=paper.get("abstract")
    )

def calculate_jaccard_similarity(set1: Set[str], set2: Set[str]) -> float:
    union = len(set1.union(set2))
    if union == 0:
        return 0.0
    intersection = len(set1.intersection(set2))
    return intersection / union

def graph_to_react_flow(G: nx.Graph, width: int = 1000, height: int = 1000) -> Dict[str, Any]:
    """
    Converts NetworkX graph to React Flow JSON.
    Updates:
    1. Sorts edges so Source is always the Older paper (Flow of Knowledge).
    2. Adds arrow markers (Old -> New).
    3. Styles Similarity edges differently from Citation edges.
    """
    nodes = []
    edges = []
    
    # ... (Keep your existing layout/pos logic here) ...
    min_dim = min(width, height)
    dynamic_scale = min_dim * 0.6
    try:
        k_val = dynamic_scale / 5.0 
        pos = nx.spring_layout(G, k=k_val, scale=dynamic_scale, iterations=100, seed=42)
    except Exception:
        pos = nx.circular_layout(G, scale=dynamic_scale)

    # 1. PROCESS NODES (Unchanged)
    for node_id, data in G.nodes(data=True):
        x, y = pos.get(node_id, (0, 0))
        
        style = {}
        if data.get("isSeed"):
            style = {
                "background": "#FFF9C4",
                "border": "2px solid #FBC02D",
                "boxShadow": "0 0 10px rgba(251, 192, 45, 0.5)",
                "fontWeight": "bold"
            }
        
        nodes.append({
            "id": node_id,
            "data": {
                "label": data["label"],
                "year": data["year"],
                "citationCount": data["citationCount"],
                "isSeed": data.get("isSeed", False),
                "abstract": data.get("abstract")
            },
            "position": {"x": x, "y": y}, 
            "type": "default",
            "style": style
        })

    # 2. PROCESS EDGES (Updated with Direction Logic)
    for u, v, data in G.edges(data=True):
        u_node = G.nodes[u]
        v_node = G.nodes[v]
        
        u_year = u_node.get("year")
        v_year = v_node.get("year")
        
        # Default direction (arbitrary)
        source = u
        target = v
        show_arrow = False
        
        # HEURISTIC: Point from Older -> Newer
        # If A(2008) and B(2013) are connected, arrow goes A -> B
        if u_year and v_year:
            try:
                # Ensure years are integers
                uy = int(u_year)
                vy = int(v_year)
                
                if uy < vy:
                    source = u
                    target = v
                    show_arrow = True
                elif vy < uy:
                    source = v
                    target = u
                    show_arrow = True
                else:
                    # Same year? No arrow, or rely on explicit 'citations' data if you have it
                    show_arrow = False 
            except ValueError:
                pass # Handle cases where year is missing or a string like "2020-05"

        # Style Logic
        edge_color = "#b1b1b7"
        stroke_dash = "0"
        
        # Make "Similarity" lines dashed to distinguish them from direct citations
        if data.get("type") == "similarity":
            stroke_dash = "5,5" 
            edge_color = "#cccccc" # Lighter for similarity

        edge_obj = {
            "id": f"e{source}-{target}",
            "source": source,
            "target": target,
            "animated": False,
            "label": f"{data['weight']:.2f}" if data.get('weight') else "",
            "style": {
                "stroke": edge_color, 
                "strokeWidth": 2,
                "strokeDasharray": stroke_dash
            }
        }
        
        # Add the Arrow Marker
        if show_arrow:
            edge_obj["markerEnd"] = { 
                "type": "arrowclosed", 
                "color": edge_color 
            }
            
        edges.append(edge_obj)

    return {"nodes": nodes, "edges": edges}
