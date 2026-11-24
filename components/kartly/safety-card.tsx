"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { SafetyCheckResult } from "@/lib/safety/check";

export interface SafetyCardProps {
  safetyCheck: SafetyCheckResult;
}

export function SafetyCard({ safetyCheck }: SafetyCardProps) {
  const [showChecks, setShowChecks] = useState(false);
  const { verdict, reasons, checks, scannedUrl } = safetyCheck;

  const isScam = verdict === "likely_scam";
  const isCareful = verdict === "be_careful";
  const isOk = verdict === "looks_ok";

  const pillStyles = isScam
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : isCareful
    ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-emerald-50 text-emerald-800 border-emerald-200";

  const pillIcon = isScam ? (
    <ShieldAlert className="size-3.5 shrink-0 text-rose-600" />
  ) : isCareful ? (
    <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
  ) : (
    <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" />
  );

  const pillLabel = isScam
    ? "Likely scam"
    : isCareful
    ? "Be careful"
    : "Looks OK";

  return (
    <div className="mt-3 p-3.5 rounded-xl border border-gray-200/90 bg-white shadow-2xs space-y-3">
      {/* Top Header Row with Pill */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Safety scan
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${pillStyles}`}
          >
            {pillIcon}
            <span>{pillLabel}</span>
          </span>
        </div>

        {/* Official helpline badge if scam detected */}
        {isScam && (
          <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
            Helpline: 1930
          </span>
        )}
      </div>

      {/* Scanned Link Display: Non-clickable if likely_scam */}
      {scannedUrl && (
        <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs flex items-center justify-between gap-2 overflow-hidden">
          <span className="text-gray-500 shrink-0 font-medium">Link:</span>
          {isScam ? (
            <span
              className="font-mono text-gray-700 truncate cursor-not-allowed select-all"
              title="Clicking disabled for safety"
            >
              {scannedUrl}
            </span>
          ) : (
            <a
              href={scannedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-emerald-700 hover:text-emerald-800 hover:underline truncate inline-flex items-center gap-1"
            >
              <span className="truncate">{scannedUrl}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          )}
        </div>
      )}

      {/* Key Reasons / Flags */}
      {reasons && reasons.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
            Key findings
          </div>
          <ul className="space-y-1 text-xs text-gray-600">
            {reasons.slice(0, 3).map((reason, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-500 font-bold shrink-0">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended Next Steps */}
      <div className="text-xs text-gray-500 border-t border-gray-100 pt-2.5 leading-relaxed">
        {isScam && (
          <p>
            <strong className="text-rose-700 font-medium">What to do:</strong>{" "}
            Do not pay, do not share OTPs or click unverified links. For financial fraud in India, call{" "}
            <span className="font-semibold text-gray-800">1930</span> or report to{" "}
            <span className="font-semibold text-gray-800">cybercrime.gov.in</span>.
          </p>
        )}
        {isCareful && (
          <p>
            <strong className="text-amber-800 font-medium">What to do:</strong>{" "}
            Proceed with caution. Buy only through official apps or verified stores. Never pay via direct UPI transfer or gift cards.
          </p>
        )}
        {isOk && (
          <p className="italic text-gray-400">
            No red flags found in these checks. This is not a guarantee. Always verify pricing and seller details at checkout.
          </p>
        )}
      </div>

      {/* Expandable Technical Checks */}
      {checks && checks.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowChecks(!showChecks)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
          >
            <span>{showChecks ? "Hide safety checks" : `View all safety checks (${checks.length})`}</span>
            {showChecks ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          {showChecks && (
            <div className="mt-2 space-y-1.5 p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-xs">
              {checks.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2 justify-between">
                  <div className="flex items-start gap-1.5 flex-1 min-w-0">
                    {check.passed ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="size-3.5 text-rose-500 shrink-0 mt-0.5" />
                    )}
                    <span className="font-medium text-gray-700">{check.name}:</span>
                    <span className="text-gray-500 truncate">{check.note}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SafetyCard;
