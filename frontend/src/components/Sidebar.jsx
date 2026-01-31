import React, { useState } from 'react';
import { api } from '../api';

const Sidebar = ({ selectedNode, onClose, seedNode, onBuildGraphForId }) => {
    // Cache for storing explanations: { nodeId: explanationString }
    const explanationCache = React.useRef({});
    const abstractCache = React.useRef({}); // Cache for abstract explanations

    const [explanation, setExplanation] = useState(null);
    const [abstractExplanation, setAbstractExplanation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [abstractLoading, setAbstractLoading] = useState(false);

    // Reset or restore explanation when looking at a new node
    React.useEffect(() => {
        if (selectedNode?.id) {
            // Restore Relation Explanation
            if (explanationCache.current[selectedNode.id]) {
                setExplanation(explanationCache.current[selectedNode.id]);
            } else {
                setExplanation(null);
            }

            // Restore Abstract Explanation
            if (abstractCache.current[selectedNode.id]) {
                setAbstractExplanation(abstractCache.current[selectedNode.id]);
            } else {
                setAbstractExplanation(null);
            }
        }
    }, [selectedNode?.id]);

    if (!selectedNode) return null;

    const { label, year, abstract, citationCount, isSeed, id } = selectedNode.data;
    // Node ID might be in selectedNode.id or selectedNode.data.id depending on how we set it. 
    // Backned sets "id" at top level. ReactFlow passes the whole node object. 
    // So selectedNode.id is the ID.

    const handleExplain = async () => {
        // Context: We need the Seed Abstract.
        const seedAbstract = seedNode?.data?.abstract || "No abstract available for seed paper.";
        const targetAbstract = abstract || "No abstract available.";

        setLoading(true);
        try {
            const res = await api.summarizeConnection(seedAbstract, targetAbstract);
            setExplanation(res.summary);
            // Cache the result
            if (selectedNode?.id) {
                explanationCache.current[selectedNode.id] = res.summary;
            }
        } catch (err) {
            setExplanation("Failed to generate explanation. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleExplainAbstract = async () => {
        const targetAbstract = abstract || "No abstract available.";

        setAbstractLoading(true);
        try {
            const res = await api.explainAbstract(targetAbstract);
            setAbstractExplanation(res.explanation);
            // Cache the result
            if (selectedNode?.id) {
                abstractCache.current[selectedNode.id] = res.explanation;
            }
        } catch (err) {
            setAbstractExplanation("Failed to explain abstract.");
        } finally {
            setAbstractLoading(false);
        }
    };

    return (
        <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl p-6 overflow-y-auto transform transition-transform z-50 flex flex-col">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-500 hover:text-black"
            >
                ✕
            </button>

            <div className="mt-8 flex-1">
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${isSeed ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {isSeed ? "Seed Paper" : "Related Paper"}
                </span>
                <h2 className="text-2xl font-bold mt-2 mb-1">{label}</h2>
                <p className="text-gray-600 mb-4">{year} • {citationCount} citations</p>

                <div className="prose prose-sm mb-6">
                    <h3 className="text-sm font-bold uppercase text-gray-400 mb-2">Abstract</h3>
                    <p className="text-gray-700 leading-relaxed max-h-60 overflow-y-auto">
                        {abstract || "No abstract available."}
                    </p>

                    {/* Explain Abstract Button */}
                    <div className="mt-4">
                        <button
                            onClick={handleExplainAbstract}
                            disabled={abstractLoading}
                            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors border ${abstractExplanation
                                ? "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            {abstractLoading ? "Analyzing..." : "💡 Simplify Abstract"}
                        </button>

                        {abstractExplanation && (
                            <div className="mt-3 bg-teal-50 p-3 rounded-md border border-teal-100 text-teal-900 text-sm animate-in fade-in slide-in-from-top-1 whitespace-pre-wrap">
                                {abstractExplanation}
                            </div>
                        )}
                    </div>
                </div>

                {!isSeed && (
                    <div className="mt-6 border-t pt-6 space-y-4">
                        {/* Explain Relationship */}
                        <div>
                            <h3 className="text-lg font-bold mb-3">AI Analysis</h3>
                            <button
                                onClick={handleExplain}
                                disabled={loading}
                                className={`w-full py-3 rounded-lg transition-colors flex items-center justify-center gap-2 mb-4 ${explanation
                                    ? "bg-purple-700 text-white ring-2 ring-purple-400 ring-offset-2"
                                    : "bg-purple-600 text-white hover:bg-purple-700"
                                    }`}
                            >
                                {loading ? "Analyzing..." : "✨ Explain Relationship"}
                            </button>

                            {explanation && (
                                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <p className="text-purple-900 text-sm">{explanation}</p>
                                </div>
                            )}
                        </div>

                        {/* Expand Graph Button */}
                        <div>
                            <h3 className="text-lg font-bold mb-3">Actions</h3>
                            <button
                                onClick={() => {
                                    // We need the ID. selectedNode.id should be it.
                                    onBuildGraphForId(selectedNode.id);
                                    onClose(); // Close sidebar after clearing
                                }}
                                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                🕸️ Expand Graph from Here
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sidebar;
