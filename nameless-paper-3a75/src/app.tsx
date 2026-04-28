/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState, useRef, useCallback, use } from "react";
import { useAgent } from "agents/react";
import { isStaticToolUIPart } from "ai";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { UIMessage } from "@ai-sdk/react";
import type { tools } from "./tools";

// List of tools that require human confirmation
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation"
];

interface Stall {
  id: string;
  number: string;
  name: string;
  zone: string;
  size: number;
  price: number;
  traffic: string;
  power: string;
  status: "available" | "occupied" | "selected";
}

const stalls: Stall[] = [
  { id: "001", number: "001", name: "Elven Grove", zone: "Enchanted Woods", size: 85, price: 2100, traffic: "High", power: "Standard", status: "available" },
  { id: "002", number: "002", name: "Mystic Corner", zone: "Enchanted Woods", size: 95, price: 2350, traffic: "High", power: "Standard", status: "available" },
  { id: "003", number: "003", name: "Shadow Spot", zone: "Enchanted Woods", size: 110, price: 2800, traffic: "Ultra High", power: "Crystal-Grid", status: "occupied" },
  { id: "004", number: "004", name: "Forest Edge", zone: "Enchanted Woods", size: 90, price: 2250, traffic: "High", power: "Standard", status: "available" },
  { id: "005", number: "005", name: "Green Haven", zone: "Enchanted Woods", size: 100, price: 2500, traffic: "Ultra High", power: "Crystal-Grid", status: "available" },
  { id: "006", number: "006", name: "Dragon's Peak", zone: "Enchanted Woods", size: 120, price: 2450, traffic: "Ultra High", power: "Crystal-Grid", status: "selected" },
  { id: "007", number: "007", name: "Silent Hollow", zone: "Enchanted Woods", size: 80, price: 2000, traffic: "Medium", power: "Standard", status: "occupied" },
  { id: "008", number: "008", name: "Ancient Oak", zone: "Enchanted Woods", size: 95, price: 2375, traffic: "High", power: "Standard", status: "available" },
  { id: "009", number: "009", name: "Dark Thicket", zone: "Enchanted Woods", size: 105, price: 2625, traffic: "Ultra High", power: "Crystal-Grid", status: "occupied" },
  { id: "010", number: "010", name: "Sunlit Glade", zone: "Enchanted Woods", size: 88, price: 2200, traffic: "High", power: "Standard", status: "available" },
  { id: "011", number: "011", name: "Moonlit Path", zone: "Mystic Lagoon", size: 92, price: 2300, traffic: "High", power: "Standard", status: "available" },
  { id: "012", number: "012", name: "Crystal Shore", zone: "Mystic Lagoon", size: 115, price: 2875, traffic: "Ultra High", power: "Crystal-Grid", status: "available" },
  { id: "013", number: "013", name: "Deep Waters", zone: "Mystic Lagoon", size: 98, price: 2450, traffic: "High", power: "Standard", status: "available" },
  { id: "014", number: "014", name: "Azure Bay", zone: "Mystic Lagoon", size: 125, price: 3125, traffic: "Legendary", power: "Etheric", status: "occupied" },
  { id: "015", number: "015", name: "Tidal Crest", zone: "Mystic Lagoon", size: 108, price: 2700, traffic: "Ultra High", power: "Crystal-Grid", status: "available" },
];

const upgrades = [
  { id: "spark", name: "Spark", price: 450, icon: "bolt", active: false },
  { id: "etheric", name: "Etheric", price: 0, icon: "wifi_channel", active: true },
  { id: "royal", name: "Royal", price: 890, icon: "security", active: false },
];

export default function BattlePlanner() {
  const [selectedStall, setSelectedStall] = useState<Stall>(stalls[5]);
  const [filter, setFilter] = useState<"all" | "available" | "large" | "under3k">("all");
  const [chatOpen, setChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Chat Agent Integration
  const agent = useAgent({ agent: "chat" });
  const [agentInput, setAgentInput] = useState("");

  const {
    messages: agentMessages,
    addToolResult,
    clearHistory,
    status,
    sendMessage,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({ agent });

  useEffect(() => {
    if (chatOpen) {
      scrollToBottom();
    }
  }, [agentMessages, chatOpen, scrollToBottom]);

  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim()) return;

    const message = agentInput;
    setAgentInput("");

    await sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message }]
      },
      { body: { stall: selectedStall } }
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getFilteredStalls = () => {
    switch (filter) {
      case "available":
        return stalls.filter(s => s.status === "available");
      case "large":
        return stalls.filter(s => s.size >= 100);
      case "under3k":
        return stalls.filter(s => s.price < 3000);
      default:
        return stalls;
    }
  };

  const getStallStatusClass = (stall: Stall) => {
    if (stall.id === selectedStall.id) {
      return "bg-primary-container border-4 border-primary block-shadow -rotate-2 scale-110 z-10";
    }
    if (stall.status === "occupied") {
      return "bg-gray-200 border-2 border-gray-400 text-gray-400";
    }
    return "bg-emerald-500/20 border-2 border-emerald-600/40 text-emerald-800 hover:bg-emerald-500/30";
  };

  const totalPrice = selectedStall.price + upgrades.filter(u => u.active).reduce((sum, u) => sum + u.price, 0);

  return (
    <>
      <HasOpenAIKey />

      {/* Header */}
      <header className="flex-none z-50 flex items-center justify-between px-6 h-16 bg-amber-50 border-b-4 border-yellow-900/10">
        <button className="w-10 h-10 flex items-center justify-center text-yellow-700">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="text-xl font-black tracking-tighter text-yellow-700 uppercase italic">Battle Planner</h1>
        <div className="w-10 h-10 rounded-full border-2 border-outline overflow-hidden">
          <img alt="Vendor" className="w-full h-full object-cover" src="https://i.pravatar.cc/150?img=12" />
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Filter Bar */}
        <div className="bg-surface-container-low border-b-2 border-outline/10 px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar z-10 shrink-0">
          <button
            onClick={() => setFilter("all")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase whitespace-nowrap ${
              filter === "all" ? "bg-primary text-on-primary" : "bg-surface-container-highest border border-outline/20 text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm">filter_list</span> All Stalls
          </button>
          <button
            onClick={() => setFilter("available")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase whitespace-nowrap ${
              filter === "available" ? "bg-primary text-on-primary" : "bg-surface-container-highest border border-outline/20 text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>circle</span> Available
          </button>
          <button
            onClick={() => setFilter("large")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase whitespace-nowrap ${
              filter === "large" ? "bg-primary text-on-primary" : "bg-surface-container-highest border border-outline/20 text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm">square_foot</span> Large (100+)
          </button>
          <button
            onClick={() => setFilter("under3k")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase whitespace-nowrap ${
              filter === "under3k" ? "bg-primary text-on-primary" : "bg-surface-container-highest border border-outline/20 text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-sm">payments</span> Under $3k
          </button>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative overflow-auto bg-[#f0f2ea] inner-map-shadow">
          <div className="min-w-[400px] p-6 space-y-4">
            {/* Enchanted Woods Zone */}
            <div className="h-20 bg-emerald-100 rounded-2xl border-2 border-emerald-900/10 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #065f46 1px, transparent 0)", backgroundSize: "10px 10px" }}></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800/40">Enchanted Woods</span>
            </div>

            {/* Stall Grid */}
            <div className="stall-grid">
              {getFilteredStalls().filter(s => s.zone === "Enchanted Woods").map((stall) => (
                <button
                  key={stall.id}
                  onClick={() => setSelectedStall(stall)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${getStallStatusClass(stall)}`}
                >
                  {stall.number}
                </button>
              ))}
            </div>

            {/* Mystic Lagoon Zone */}
            <div className="h-16 bg-blue-100 rounded-2xl border-2 border-blue-900/10 relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #1e3a8a 1px, transparent 0)", backgroundSize: "15px 15px" }}></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-800/40">Mystic Lagoon</span>
            </div>

            <div className="stall-grid">
              {getFilteredStalls().filter(s => s.zone === "Mystic Lagoon").map((stall) => (
                <button
                  key={stall.id}
                  onClick={() => setSelectedStall(stall)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${getStallStatusClass(stall)}`}
                >
                  {stall.number}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur p-2 rounded-lg border border-outline/20 text-[9px] font-black uppercase space-y-1">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-emerald-500"></div> Available</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-gray-400"></div> Occupied</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-primary"></div> Selected</div>
          </div>

          {/* Map Controls */}
          <div className="absolute right-4 top-4 flex flex-col gap-2">
            <button className="w-10 h-10 bg-white rounded-xl border-2 border-outline flex items-center justify-center block-shadow active:scale-95"><span className="material-symbols-outlined">zoom_in</span></button>
            <button className="w-10 h-10 bg-white rounded-xl border-2 border-outline flex items-center justify-center block-shadow active:scale-95"><span className="material-symbols-outlined">zoom_out</span></button>
            <button className="w-10 h-10 bg-white rounded-xl border-2 border-outline flex items-center justify-center block-shadow active:scale-95"><span className="material-symbols-outlined">my_location</span></button>
          </div>
        </div>

        {/* AI Chat Toggle Button */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="absolute bottom-24 right-4 w-14 h-14 bg-primary text-on-primary rounded-full border-4 border-primary-dim flex items-center justify-center block-shadow active:scale-95 z-20"
        >
          <span className="material-symbols-outlined text-2xl">smart_toy</span>
        </button>

        {/* AI Chat Panel */}
        {chatOpen && (
          <div className="absolute bottom-40 right-4 w-80 h-96 bg-surface-container-lowest rounded-2xl border-4 border-primary/20 block-shadow flex flex-col z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-on-primary">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined">support_agent</span>
                <span className="text-sm font-black uppercase">AI Assistant</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="material-symbols-outlined">close</button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {agentMessages.length === 0 && (
                <div className="text-center py-4">
                  <div className="bg-primary/10 text-primary rounded-full p-2 inline-flex mb-2">
                    <span className="material-symbols-outlined">chat</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">Ask about stalls, pricing, or booking!</p>
                </div>
              )}

              {agentMessages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                      isUser ? "bg-primary text-on-primary rounded-br-none" : "bg-surface-container text-on-surface rounded-bl-none"
                    }`}>
                      {m.parts?.map((part, i) => {
                        if (part.type === "text") {
                          return <div key={i}>{part.text}</div>;
                        }
                        return null;
                      })}
                      <div className={`text-[9px] mt-1 ${isUser ? "text-on-primary/70" : "text-on-surface-variant"}`}>
                        {formatTime(m.metadata?.createdAt ? new Date(m.metadata.createdAt) : new Date())}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleAgentSubmit} className="p-3 border-t border-outline/20 bg-surface-container-low">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  placeholder="Ask about stalls..."
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-outline/30 bg-surface-container-lowest focus:outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={!agentInput.trim() || status === "streaming"}
                  className="px-3 py-2 bg-primary text-on-primary rounded-lg disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Selected Stall Details */}
        <div className="bg-surface-container-lowest border-t-4 border-primary/20 p-4 shrink-0 shadow-[0_-8px_16px_rgba(0,0,0,0.05)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-secondary text-on-secondary text-[9px] font-black rounded uppercase">Legendary Stall</span>
                <span className="text-[10px] font-bold text-on-surface-variant uppercase">Stall {selectedStall.number} • จองแผง</span>
              </div>
              <h3 className="text-xl font-black text-on-surface mt-1 marker-rotate">{selectedStall.name}</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-tertiary uppercase">Investment</p>
              <p className="text-xl font-black text-tertiary tracking-tight">${totalPrice.toLocaleString()}.00</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-2 bg-surface-container rounded-lg border border-outline/10 text-center">
              <p className="text-[8px] font-black text-on-surface-variant uppercase">Size</p>
              <p className="text-xs font-black">{selectedStall.size} sq ft</p>
            </div>
            <div className="p-2 bg-surface-container rounded-lg border border-outline/10 text-center">
              <p className="text-[8px] font-black text-on-surface-variant uppercase">Traffic</p>
              <p className="text-xs font-black text-primary">{selectedStall.traffic}</p>
            </div>
            <div className="p-2 bg-surface-container rounded-lg border border-outline/10 text-center">
              <p className="text-[8px] font-black text-on-surface-variant uppercase">Power</p>
              <p className="text-xs font-black">{selectedStall.power}</p>
            </div>
          </div>

          {/* Upgrades */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
            {upgrades.map((upgrade) => (
              <button
                key={upgrade.id}
                className={`flex-none w-28 p-2 rounded-lg flex items-center gap-2 border ${
                  upgrade.active
                    ? "bg-secondary-container text-on-secondary-container border-secondary"
                    : "bg-surface-container border-outline/20"
                }`}
              >
                <span className={`material-symbols-outlined text-sm rounded-full p-0.5 ${
                  upgrade.active ? "bg-secondary text-on-secondary" : "bg-tertiary text-on-tertiary"
                }`} style={upgrade.active ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {upgrade.icon}
                </span>
                <div className="text-left">
                  <p className="text-[9px] font-black leading-none">{upgrade.name}</p>
                  <p className="text-[8px] font-bold">{upgrade.active ? "Added" : `+$${upgrade.price}`}</p>
                </div>
              </button>
            ))}
          </div>

          <button className="w-full py-4 bg-primary text-on-primary rounded-xl border-b-4 border-primary-dim text-lg font-black italic tracking-tight active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center gap-3">
            <span className="material-symbols-outlined">swords</span>
            CLAIM YOUR LEGENDARY STALL
          </button>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="flex-none bg-amber-50 h-20 px-6 flex justify-between items-center border-t border-outline/10">
        <div className="flex flex-col items-center justify-center text-primary">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>strategy</span>
          <span className="text-[10px] font-black uppercase">Plan</span>
        </div>
        <div className="flex flex-col items-center justify-center text-on-surface-variant/40">
          <span className="material-symbols-outlined">inventory_2</span>
          <span className="text-[10px] font-black uppercase">Cargo</span>
        </div>
        <div className="flex flex-col items-center justify-center text-on-surface-variant/40">
          <span className="material-symbols-outlined">payments</span>
          <span className="text-[10px] font-black uppercase">Vault</span>
        </div>
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="px-4 py-2 bg-surface-container-high rounded-full border-2 border-outline-variant text-[10px] font-black text-on-surface-variant flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">support_agent</span> HELP
        </button>
      </nav>
    </>
  );
}

const hasOpenAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
  res.json<{ success: boolean }>()
);

function HasOpenAIKey() {
  const hasOpenAiKey = use(hasOpenAiKeyPromise);

  if (!hasOpenAiKey.success) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                  OpenAI API Key Not Configured
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Please configure an OpenAI API key via wrangler secret.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
