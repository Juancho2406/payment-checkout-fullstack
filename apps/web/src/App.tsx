import { useAppSelector } from "./store/hooks";
import { ProductPage } from "./features/product/ProductPage";
import { StatusPage } from "./pages/StatusPage";

export function App() {
  const screen = useAppSelector((state) => state.checkout.screen);
  return screen === "status" ? <StatusPage /> : <ProductPage />;
}
