import { createRoot } from "react-dom/client";
import { CloudSaveLab } from "./CloudSaveLab";
const root = document.getElementById("root");
if (!root) throw new Error("Synthetic cloud lab root missing.");
createRoot(root).render(<CloudSaveLab />);
