"use client";

import { useState } from "react";
import { createQRStation } from "./create-station-action";

export default function CreateQRStationButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; code?: string; error?: string } | null>(null);

  async function handleCreate() {
    setLoading(true);
    setResult(null);

    const res = await createQRStation();
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold mb-2">🎯 Auto-Create QR Quiz Station</h2>
      <p className="text-sm text-slate-500 mb-4">
        This will create a station called "Find and Scan the QR code" with code <code className="bg-slate-100 px-1 rounded">QRQUIZ</code>.
        Points from the quiz will be automatically added to this station.
      </p>

      <button
        onClick={handleCreate}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? "Creating..." : "Create QR Quiz Station"}
      </button>

      {result && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${
          result.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
        }`}>
          {result.ok ? (
            <>
              ✅ Station created! Station code: <strong>{result.code}</strong>
              <br />
              <span className="text-xs">
                Share this link with teams: <code>{typeof window !== "undefined" ? window.location.origin : ""}/team/QRQUIZ/qr-form</code>
              </span>
            </>
          ) : (
            <>❌ Error: {result.error}</>
          )}
        </div>
      )}
    </div>
  );
}
