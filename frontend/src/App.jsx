import React, { useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from './api';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';

const App = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSearch = async (query) => {
    setLoading(true);
    try {
      // 1. Search for paper to get ID
      const searchRes = await api.search(query);
      if (searchRes.results && searchRes.results.length > 0) {
        const paperId = searchRes.results[0].paperId;
        // 2. Build graph with dynamic scaling
        const width = window.innerWidth;
        const height = window.innerHeight;
        const graphData = await api.buildGraph(paperId, width, height);

        setNodes(graphData.nodes);
        setEdges(graphData.edges);
      } else {
        alert("No papers found!");
      }
    } catch (error) {
      console.error(error);
      alert("Error building graph");
    } finally {
      setLoading(false);
    }
  };

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const closeSidebar = () => setSelectedNode(null);

  const [edgeThreshold, setEdgeThreshold] = useState(0);

  // Filter edges based on threshold
  const filteredEdges = edges.filter(edge => {
    const weight = parseFloat(edge.label || "0");
    return weight >= edgeThreshold;
  });

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      {/* Header Elements */}
      <div className="absolute top-0 left-0 w-full z-10 p-4 pointer-events-none">

        {/* Search Bar - Centered */}
        <div className="pointer-events-auto absolute top-4 left-1/2 transform -translate-x-1/2 w-full max-w-xl">
          <div className="flex justify-center">
            <SearchBar onSearch={onSearch} />
          </div>
        </div>

        {/* Edge Threshold Slider - Top Right */}
        <div className="pointer-events-auto absolute top-4 right-4 bg-white/90 backdrop-blur p-4 rounded-lg shadow-md w-64">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Connection Strength: {Math.round(edgeThreshold * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={edgeThreshold}
            onChange={(e) => setEdgeThreshold(parseFloat(e.target.value))}
            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>All</span>
            <span>Strong</span>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Graph Canvas */}
      <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={filteredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#aaa" gap={16} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Sidebar */}
      <Sidebar
        selectedNode={selectedNode}
        onClose={closeSidebar}
        seedNode={nodes.find(n => n.data.isSeed)}
        onExpandGraph={(paperId) => {
          // Start search/build for this new ID
          // We might need to handle this differently if we want to "add" to existing graph
          // But requirement implies "open graph from that clicked paper", usually meaning 
          // focusing on that paper as the OLD seed.
          onSearch(paperId); // Re-run search/build for this ID.
          // Note: onSearch expects query string, but our API search handles title/ID.
          // Wait, api.search searches by query. api.buildGraph takes ID.
          // onSearch does BOTH.
          // If we pass an ID to onSearch, s2_client.search_paper(query) might find it if query is ID?
          // Semantic Scholar search endpoint usually takes text.
          // If we have the ID, we should just call buildGraph directly!
          // Let's refactor onSearch or just make a new handler.
        }}
        onBuildGraphForId={async (id) => {
          setLoading(true);
          try {
            const graphData = await api.buildGraph(id);
            setNodes(graphData.nodes);
            setEdges(graphData.edges);
          } catch (err) {
            alert("Failed to build graph");
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
};

export default App;
