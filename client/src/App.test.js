import { act, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

test("renders arcade cockpit entry", () => {
  render(<App />);
  expect(screen.getByText(/Trading Arcade/i)).toBeInTheDocument();
  expect(screen.getByText(/Order Ticket/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/split battle arena/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/portfolio statistics/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/ticker selector/i)).toBeInTheDocument();
});

test("asks for a player name and stores it locally", async () => {
  render(<App />);

  expect(screen.getByRole("dialog", { name: /enter your trader name/i })).toBeInTheDocument();
  act(() => {
    fireEvent.change(screen.getByRole("textbox", { name: /player name/i }), { target: { value: "Nova" } });
  });
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: /start daily tape/i }));
  });

  expect(screen.queryByRole("dialog", { name: /enter your trader name/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /change player name/i })).toHaveTextContent("Nova");
  expect(JSON.parse(window.localStorage.getItem("trading-arcade-profile"))).toMatchObject({
    callsign: "Nova",
    hasCompletedNamePrompt: true,
  });
});

test("labels hold as next candle", async () => {
  render(<App />);
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: /skip as guest pilot/i }));
  });

  expect(screen.getByRole("button", { name: /next candle/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^hold$/i })).not.toBeInTheDocument();
});

test("opens a match result modal when the run finishes", async () => {
  render(<App />);
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: /skip as guest pilot/i }));
  });

  for (let index = 0; index < 36; index += 1) {
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /next candle/i }));
    });
  }

  expect(screen.getByText(/match result/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /run it back/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /new tape/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /share replay/i })).toBeInTheDocument();
});
