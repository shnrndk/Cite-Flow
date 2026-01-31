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

  const [layoutMode, setLayoutMode] = useState("force"); // "force" | "timeline"
  const defaultNodePositions = React.useRef({}); // Store original positions
  const [rfInstance, setRfInstance] = useState(null);

  const getTimelineLayout = useCallback((nodes) => {
    // 1. Group nodes by year
    const nodesByYear = {};
    let minYear = Infinity;
    let maxYear = -Infinity;

    nodes.forEach(node => {
      const year = parseInt(node.data.year) || 0;
      if (year > 1900) { // Filter out invalid/missing years
        if (year < minYear) minYear = year;
        if (year > maxYear) maxYear = year;

        if (!nodesByYear[year]) nodesByYear[year] = [];
        nodesByYear[year].push(node);
      }
    });

    if (minYear === Infinity) return nodes; // No valid dates found

    // 2. Calculate positions
    const YEAR_SPACING = 250;
    const COLUMN_SPACING = 100;

    // Sort years to iterate in order
    const years = Object.keys(nodesByYear).sort((a, b) => a - b);

    // Map year -> index (0, 1, 2...)
    const yearToIndex = {};
    years.forEach((year, index) => {
      yearToIndex[year] = index;
    });

    const timelineNodes = nodes.map(node => {
      const year = parseInt(node.data.year) || 0;

      // If node has no valid year, we might pile them at the start or end
      if (year <= 1900) return node;

      // Use ordinal index instead of absolute difference
      const yearIndex = yearToIndex[year];
      const x = yearIndex * YEAR_SPACING;

      // Y Position: Center based on number of nodes in that year
      const papersInYear = nodesByYear[year];
      const indexInYear = papersInYear.findIndex(n => n.id === node.id);

      // Center vertically around 0
      const totalHeight = (papersInYear.length - 1) * COLUMN_SPACING;
      const startY = -totalHeight / 2;
      const y = startY + (indexInYear * COLUMN_SPACING);

      return {
        ...node,
        position: { x, y },
        draggable: false, // Lock nodes in timeline view
      };
    });

    // Create Label Nodes for each year
    const labelNodes = years.map((year) => {
      const yearIndex = yearToIndex[year];
      const x = yearIndex * YEAR_SPACING;

      return {
        id: `year-label-${year}`,
        type: 'default', // Using default node type for simplicity
        data: { label: year },
        position: { x, y: 400 }, // Place below the graph
        draggable: false,
        selectable: false,
        style: {
          background: 'transparent',
          border: 'none',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#aaaaaa',
          width: 100,
          textAlign: 'center',
          pointerEvents: 'none'
        },
        zIndex: -1
      };
    });

    return [...timelineNodes, ...labelNodes];
  }, []);

  const toggleLayout = useCallback(() => {
    if (layoutMode === "force") {
      // Switch to Timeline
      // 1. Save current "Force" positions
      nodes.forEach(n => {
        if (!n.id.startsWith('year-label-')) {
          defaultNodePositions.current[n.id] = { ...n.position };
        }
      });

      // 2. Calculate Timeline positions
      const timelineNodes = getTimelineLayout(nodes.filter(n => !n.id.startsWith('year-label-')));
      setNodes(timelineNodes);
      setLayoutMode("timeline");

      // Center view after short delay to allow render
      setTimeout(() => {
        if (rfInstance) rfInstance.fitView({ padding: 0.2, duration: 800 });
      }, 50);

    } else {
      // Switch back to Force
      // Filter out label nodes first
      const paperNodes = nodes.filter(n => !n.id.startsWith('year-label-'));

      setNodes(paperNodes.map(n => {
        const savedPos = defaultNodePositions.current[n.id];
        return {
          ...n,
          position: savedPos || n.position, // Fallback if lost
          draggable: true, // Re-enable dragging
        };
      }));
      setLayoutMode("force");

      // Center view back to original graph
      setTimeout(() => {
        if (rfInstance) rfInstance.fitView({ padding: 0.2, duration: 800 });
      }, 50);
    }
  }, [layoutMode, nodes, getTimelineLayout, setNodes, rfInstance]);

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

        // Reset layout mode on new search
        setLayoutMode("force");
        defaultNodePositions.current = {};

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

          {/* Timeline View Toggle */}
          <button
            onClick={toggleLayout}
            className={`w-full py-2 px-3 rounded-md text-sm font-semibold transition-colors border ${layoutMode === "timeline"
              ? "bg-indigo-100 text-indigo-700 border-indigo-200"
              : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
              }`}
          >
            {layoutMode === "timeline" ? "🔄 Switch to Network" : "⏳ Switch to Timeline"}
          </button>

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
          onInit={setRfInstance}
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
