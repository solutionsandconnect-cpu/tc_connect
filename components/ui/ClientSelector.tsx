"use client";

import { useRef, useState } from "react";
import { useClients } from "@/hooks/useClients";
import type { Client } from "@/types";

interface Props {
  value: string;
  onChange: (id: string, name: string) => void;
}

export default function ClientSelector({ value, onChange }: Props) {
  const { clients, loading } = useClients();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const fullName = (c: Client) => [c.nom, c.prenom].filter(Boolean).join(" ");

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.nom.toLowerCase().includes(q) ||
      c.prenom.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const select = (client: Client) => {
    const name = fullName(client);
    onChange(client.id, name);
    setSelectedName(name);
    setSearch("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full border rounded-lg px-3 py-2.5 flex items-center justify-between text-sm transition ${
          open ? "border-blue-400 ring-2 ring-blue-100" : "hover:border-gray-400"
        }`}
      >
        <span className={selectedName ? "text-gray-900" : "text-gray-400"}>
          {loading ? "Chargement..." : selectedName || "Sélectionner un client..."}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b">
            <input
              autoFocus
              className="w-full px-3 py-2 text-sm outline-none placeholder-gray-400"
              placeholder="Rechercher par nom ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">
                {clients.length === 0 ? "Aucun client — créez-en un dans la section Clients" : "Aucun résultat"}
              </div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.id}
                  onClick={() => select(c)}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition ${value === c.id ? "bg-blue-50" : ""}`}
                >
                  <div className="font-medium text-sm text-gray-900">{fullName(c)}</div>
                  {c.email && <div className="text-xs text-gray-500 mt-0.5">{c.email}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
