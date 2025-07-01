import React from "react";
import "./App.css";

function App() {
  return (
    <div className="container">
      <img
        src="/coming-soon.jpg"
        alt="Coming Soon Arca Finance"
        className="hero-image"
      />
      <h1>Coming Soon</h1>
      <p>arca Finance – Stay tuned for our DeFi launch.</p>
      <a
        href="https://x.com/arcaFinance"
        target="_blank"
        rel="noopener noreferrer"
        className="social-link"
      >
        Follow us on X
      </a>
    </div>
  );
}

export default App;
