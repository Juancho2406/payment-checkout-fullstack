import { render, screen } from "@testing-library/react";
import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it("labels Visa, Mastercard and the empty state", () => {
    const { rerender } = render(<BrandMark brand="VISA" />);
    expect(screen.getByLabelText("Visa")).toBeInTheDocument();
    rerender(<BrandMark brand="MASTERCARD" />);
    expect(screen.getByLabelText("Mastercard")).toBeInTheDocument();
    rerender(<BrandMark brand={null} />);
    expect(screen.getByText("Tarjeta")).toBeInTheDocument();
  });
});
