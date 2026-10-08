import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Portal from "@/pages/Portal";

function App() {
  return (
    <div className="App dark">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Portal />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
    </div>
  );
}

export default App;
