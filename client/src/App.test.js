import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders arcade play entry", () => {
  render(<App />);
  expect(screen.getByText(/Play Daily Run/i)).toBeInTheDocument();
});
