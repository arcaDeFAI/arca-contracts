/**
 * CoinGecko Attribution Component Tests
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  CoinGeckoAttribution,
  CoinGeckoAttributionMinimal,
  CoinGeckoAttributionFull,
} from "../coingecko-attribution";

describe("CoinGecko Attribution Components", () => {
  describe("CoinGeckoAttribution", () => {
    it("should render minimal variant by default", () => {
      render(<CoinGeckoAttribution />);
      
      expect(screen.getByText("CoinGecko")).toBeInTheDocument();
      expect(screen.queryByText("Price data by")).not.toBeInTheDocument();
    });

    it("should render full variant with prefix text", () => {
      render(<CoinGeckoAttribution variant="full" />);
      
      expect(screen.getByText("Price data by")).toBeInTheDocument();
      expect(screen.getByText("CoinGecko")).toBeInTheDocument();
    });

    it("should have proper link with UTM tracking", () => {
      render(<CoinGeckoAttribution />);
      
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        "https://www.coingecko.com?utm_source=arca&utm_medium=referral"
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should apply custom className", () => {
      render(<CoinGeckoAttribution className="custom-class" />);
      
      const container = screen.getByText("CoinGecko").closest("div");
      expect(container).toHaveClass("custom-class");
    });

    it("should render with small size by default", () => {
      render(<CoinGeckoAttribution />);
      
      const container = screen.getByText("CoinGecko").closest("div");
      expect(container).toHaveClass("text-xs");
    });

    it("should render with medium size when specified", () => {
      render(<CoinGeckoAttribution size="medium" />);
      
      const container = screen.getByText("CoinGecko").closest("div");
      expect(container).toHaveClass("text-sm");
    });
  });

  describe("CoinGeckoAttributionMinimal", () => {
    it("should render minimal variant", () => {
      render(<CoinGeckoAttributionMinimal />);
      
      expect(screen.getByText("CoinGecko")).toBeInTheDocument();
      expect(screen.queryByText("Price data by")).not.toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(<CoinGeckoAttributionMinimal className="minimal-class" />);
      
      const container = screen.getByText("CoinGecko").closest("div");
      expect(container).toHaveClass("minimal-class");
    });
  });

  describe("CoinGeckoAttributionFull", () => {
    it("should render full variant with prefix", () => {
      render(<CoinGeckoAttributionFull />);
      
      expect(screen.getByText("Price data by")).toBeInTheDocument();
      expect(screen.getByText("CoinGecko")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(<CoinGeckoAttributionFull className="full-class" />);
      
      const container = screen.getByText("CoinGecko").closest("div");
      expect(container).toHaveClass("full-class");
    });
  });

  describe("Accessibility", () => {
    it("should have proper link semantics", () => {
      render(<CoinGeckoAttribution />);
      
      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAccessibleName("CoinGecko");
    });

    it("should have SVG logo", () => {
      const { container } = render(<CoinGeckoAttribution />);
      
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });
});