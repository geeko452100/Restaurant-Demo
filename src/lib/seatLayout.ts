// The restaurant's floor plan, as a 2D array: each row is a section of
// the room, each cell is a numbered seat or `null` for an aisle/empty
// gap. This is the single source of truth for what seats exist — the
// reservation API validates against it and the public picker renders
// whatever grid it returns, so the layout never gets duplicated client-side.

export type SeatType = "booth" | "chair" | "stool";

export interface Seat {
  number: number;
  type: SeatType;
  capacity: number;
}

export const SEAT_LAYOUT: (Seat | null)[][] = [
  // Bar stools
  [
    { number: 1, type: "stool", capacity: 1 },
    { number: 2, type: "stool", capacity: 1 },
    { number: 3, type: "stool", capacity: 1 },
    { number: 4, type: "stool", capacity: 1 },
    { number: 5, type: "stool", capacity: 1 },
    { number: 6, type: "stool", capacity: 1 },
  ],
  // Aisle
  [null, null, null, null, null, null],
  // Booths
  [
    { number: 7, type: "booth", capacity: 4 },
    { number: 8, type: "booth", capacity: 4 },
    { number: 9, type: "booth", capacity: 4 },
    { number: 10, type: "booth", capacity: 4 },
    { number: 11, type: "booth", capacity: 4 },
    { number: 12, type: "booth", capacity: 4 },
  ],
  // Aisle
  [null, null, null, null, null, null],
  // Two-top tables
  [
    { number: 13, type: "chair", capacity: 2 },
    { number: 14, type: "chair", capacity: 2 },
    { number: 15, type: "chair", capacity: 2 },
    { number: 16, type: "chair", capacity: 2 },
    { number: 17, type: "chair", capacity: 2 },
    { number: 18, type: "chair", capacity: 2 },
  ],
];

export const SEATS: Seat[] = SEAT_LAYOUT.flat().filter((seat): seat is Seat => seat !== null);

export function findSeat(seatNumber: number): Seat | undefined {
  return SEATS.find((seat) => seat.number === seatNumber);
}
