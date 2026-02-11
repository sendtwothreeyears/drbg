import { Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import Conversation from "./components/Conversation";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/conversation/:conversationId" element={<Conversation />} />
    </Routes>
  );
}

export default App;
