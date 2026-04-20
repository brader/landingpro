import React, { Component } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "../styles.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="boot-fallback">
          <strong>LandingPro gagal dimuat</strong>
          <span>{this.state.error.message}</span>
          <button
            className="primary-btn"
            onClick={() => {
              localStorage.removeItem("landingpro-react-state-v1");
              window.location.reload();
            }}
          >
            Reset Builder
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
