import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "react-oidc-context";
import "@/index.css";
import App from "@/App";
import { queryClient } from "@/lib/queryClient";
import { cognitoAuthConfig } from "@/auth";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>,
);
