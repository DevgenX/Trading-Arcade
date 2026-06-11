import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders arcade cockpit entry", () => {
  render(<App />);
  expect(screen.getByText(/Trading Arcade/i)).toBeInTheDocument();
  expect(screen.getByText(/Order Ticket/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/portfolio statistics/i)).toBeInTheDocument();
});
