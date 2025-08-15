from typing import List, Dict

def get_filtered_results(results: List[Dict], filter_list: List[str]) -> List[Dict]:
    """Filter results based on domain/content filters."""
    if not filter_list:
        return results
        
    filtered = []
    for result in results:
        url = result.get("url", "").lower()
        if any(f.lower() in url for f in filter_list):
            filtered.append(result)
    return filtered