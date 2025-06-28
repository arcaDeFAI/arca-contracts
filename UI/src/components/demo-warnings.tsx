/**
 * Demo Warning Components
 *
 * UI components to warn users about fake/demo data throughout the application
 */

import React, { useState } from "react";
import { AlertTriangle, X, Info } from "lucide-react";
import { shouldShowDemoWarning, DEMO_MESSAGES } from "../config/demo-mode";

/**
 * Demo Mode Modal - Shows on first app load to warn users about fake data
 */
export function DemoModeModal() {
  const [isOpen, setIsOpen] = useState(() => {
    // Only show if demo mode is active and user hasn't dismissed it
    if (!shouldShowDemoWarning("MODAL_TITLE")) return false;
    return !localStorage.getItem("demo-warning-dismissed");
  });

  const handleDismiss = () => {
    localStorage.setItem("demo-warning-dismissed", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-yellow-500 w-6 h-6" />
          <h2 className="text-xl font-semibold text-gray-900">
            {DEMO_MESSAGES.MODAL_TITLE}
          </h2>
        </div>

        <p className="text-gray-700 mb-6 leading-relaxed">
          {DEMO_MESSAGES.MODAL_DESCRIPTION}
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-6">
          <div className="flex items-start gap-2">
            <Info className="text-yellow-600 w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <strong>Fake Data Includes:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Token prices (wS: $0.85, METRO: $2.50)</li>
                <li>APR percentages (45% is not real)</li>
                <li>Portfolio USD values</li>
                <li>TVL calculations</li>
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          I Understand - Continue with Demo
        </button>
      </div>
    </div>
  );
}

/**
 * Demo Banner - Persistent warning banner for dashboard
 */
export function DemoBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!shouldShowDemoWarning("DASHBOARD_BANNER") || !isVisible) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-yellow-500 w-5 h-5" />
          <p className="text-yellow-800 font-medium">
            {DEMO_MESSAGES.DASHBOARD_BANNER}
          </p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-yellow-500 hover:text-yellow-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Demo Data Wrapper - Adds warning badge to financial data displays
 */
interface DemoDataWrapperProps {
  children: React.ReactNode;
  type: "price" | "apr" | "portfolio" | "tvl";
  className?: string;
}

export function DemoDataWrapper({
  children,
  type,
  className = "",
}: DemoDataWrapperProps) {
  const getWarningMessage = () => {
    switch (type) {
      case "price":
        return DEMO_MESSAGES.FAKE_PRICE_WARNING;
      case "apr":
        return DEMO_MESSAGES.FAKE_APR_WARNING;
      case "portfolio":
        return DEMO_MESSAGES.FAKE_PORTFOLIO_WARNING;
      case "tvl":
        return DEMO_MESSAGES.FAKE_PRICE_WARNING;
      default:
        return "DEMO DATA";
    }
  };

  if (!shouldShowDemoWarning("DASHBOARD_BANNER")) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      {children}
      <div className="absolute -top-1 -right-1">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
          <AlertTriangle className="w-3 h-3" />
          {getWarningMessage()}
        </span>
      </div>
    </div>
  );
}

/**
 * Inline Warning - Small warning text for specific metrics
 */
interface InlineWarningProps {
  type: "price" | "apr" | "portfolio" | "tvl";
  className?: string;
}

export function InlineWarning({ type, className = "" }: InlineWarningProps) {
  if (!shouldShowDemoWarning("DASHBOARD_BANNER")) {
    return null;
  }

  const getWarningMessage = () => {
    switch (type) {
      case "price":
        return "Demo prices";
      case "apr":
        return "Test APR";
      case "portfolio":
        return "Demo values";
      case "tvl":
        return "Demo TVL";
      default:
        return "Demo data";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-yellow-600 ${className}`}
    >
      <AlertTriangle className="w-3 h-3" />
      {getWarningMessage()}
    </span>
  );
}

/**
 * APR Warning Badge - Specific warning for APR displays
 */
export function APRWarningBadge() {
  if (!shouldShowDemoWarning("FAKE_APR_WARNING")) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded border border-red-200">
      <AlertTriangle className="w-3 h-3" />
      {DEMO_MESSAGES.FAKE_APR_WARNING}
    </div>
  );
}
