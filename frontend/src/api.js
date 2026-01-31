const API_BASE_URL = "http://localhost:8000";

export const api = {
    search: async (query) => {
        const response = await fetch(`${API_BASE_URL}/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Search failed");
        return response.json();
    },
    buildGraph: async (paperId, width, height) => {
        // Default to a reasonable size if not provided
        const w = width || 1000;
        const h = height || 1000;
        const response = await fetch(`${API_BASE_URL}/build_graph?paper_id=${paperId}&width=${w}&height=${h}`);
        if (!response.ok) throw new Error("Failed to build graph");
        return response.json();
    },
    summarizeConnection: async (sourceAbstract, targetAbstract) => {
        const response = await fetch(`${API_BASE_URL}/summarize_connection`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ source_abstract: sourceAbstract, target_abstract: targetAbstract }),
        });
        if (!response.ok) throw new Error("Summarization failed");
        return response.json();
    },
    explainAbstract: async (abstract) => {
        const response = await fetch(`${API_BASE_URL}/explain_abstract`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ abstract: abstract }),
        });
        if (!response.ok) throw new Error("Explanation failed");
        return response.json();
    }
};
