import React, { useState, useCallback, useEffect } from 'react';
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

  // Update node styles when selection changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const isSelected = selectedNode && n.id === selectedNode.id;

        if (isSelected) {
          return {
            ...n,
            style: {
              ...n.style,
              background: '#F3E8FF', // Purple 100
              border: '3px solid #9333EA', // Purple 600
              boxShadow: '0 0 15px rgba(147, 51, 234, 0.5)',
              transition: 'all 0.3s ease',
            },
          };
        }

        // Revert to original styling
        if (n.data.isSeed) {
          return {
            ...n,
            style: {
              background: "#FFF9C4",
              border: "2px solid #FBC02D",
              boxShadow: "0 0 10px rgba(251, 192, 45, 0.5)",
              fontWeight: "bold",
              transition: 'all 0.3s ease',
            },
          };
        }

        // Default style for regular nodes
        return {
          ...n,
          style: {
            // Ensure we clean up any leftover styles
            background: undefined,
            border: undefined,
            boxShadow: undefined,
            transition: 'all 0.3s ease',
          },
        };
      })
    );
  }, [selectedNode, setNodes]);

  const closeSidebar = () => setSelectedNode(null);

  const [edgeThreshold, setEdgeThreshold] = useState(0);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [isHoverEnabled, setIsHoverEnabled] = useState(true);

  // Filter edges based on threshold
  const filteredEdges = edges.filter(edge => {
    const weight = parseFloat(edge.label || "0");
    return weight >= edgeThreshold;
  });

  const onNodeMouseEnter = useCallback((event, node) => {
    setHoveredNode(node);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeMouseMove = useCallback((event) => {
    setTooltipPos({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

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

        {/* Settings Panel - Top Right */}
        <div className="pointer-events-auto absolute top-4 right-4 bg-white/90 backdrop-blur p-4 rounded-lg shadow-md w-64 space-y-4">

          {/* Hover Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Show Tooltips</span>
            <button
              onClick={() => setIsHoverEnabled(!isHoverEnabled)}
              className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${isHoverEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${isHoverEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Slider */}
          <div>
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
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Tooltip */}
      {hoveredNode && isHoverEnabled && (
        <div
          className="fixed z-50 bg-gray-900 text-white p-3 rounded-lg shadow-xl pointer-events-none max-w-xs transform -translate-x-1/2 -translate-y-[120%]"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="font-bold text-sm mb-1 line-clamp-2">{hoveredNode.data.label}</div>
          <div className="text-xs text-gray-300 flex justify-between gap-4">
            <span>{hoveredNode.data.year}</span>
            <span>{hoveredNode.data.citationCount} Citations</span>
          </div>
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
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseMove={onNodeMouseMove}
          onNodeMouseLeave={onNodeMouseLeave}
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
