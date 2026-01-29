from open_alex import open_alex_client
import sys

def test_openalex():
    print("Testing OpenAlex Search...")
    query = "Attention Is All You Need"
    results = open_alex_client.search_paper(query)
    if not results:
        print("FAIL: No results found for search.")
        return
    
    print(f"PASS: Found {len(results)} results.")
    first_paper = results[0]
    print(f"First Result: {first_paper['title']} ({first_paper['year']}) - ID: {first_paper['paperId']}")
    
    if not first_paper.get("abstract"):
        print("WARNING: Abstract failed to decode or missing.") # Might happen if inverted index missing
    else:
        print(f"PASS: Abstract decoded ({len(first_paper['abstract'])} chars).")

    print("\nTesting Get Details...")
    details = open_alex_client.get_paper_details(first_paper['paperId'])
    if not details:
        print("FAIL: Could not fetch details.")
        return
    
    print(f"PASS: Details fetched. References count: {len(details['references'])}")
    
    # Test Batch
    print("\nTesting Batch Fetch...")
    refs = [r["paperId"] for r in details["references"][:3]]
    if refs:
        batch_results = open_alex_client.get_papers_batch(refs)
        print(f"PASS: Batch fetched {len(batch_results)}/{len(refs)} papers.")
    else:
        print("SKIP: No references to batch fetch.")

if __name__ == "__main__":
    test_openalex()
