import type { RoomPhoto } from "./room-config-card";

// Shared by the property form and its configuration popups
export type RoomState = {
  id?: string; label: string; capacity: string; ac: boolean; rent: string; occupied: string; floor: string;
  roomType: string; sizeSqm: string; bathAttached: boolean; bathArea: string; photos: RoomPhoto[];
};
export type CategoryMedia = {
  id?: string; capacity: number; mediaType: "IMAGE" | "VIDEO"; path?: string; originalName: string; src: string; file?: File;
};

export const sm = "field !bg-background";

export const blankRoom = (label: string): RoomState => ({
  label, capacity: "2", ac: false, rent: "", occupied: "0", floor: "", roomType: "Bedroom",
  sizeSqm: "", bathAttached: true, bathArea: "", photos: [],
});

export const renumber = (rs: RoomState[]) =>
  rs.map((r, i) => (/^Bedroom \d+$/.test(r.label) ? { ...r, label: `Bedroom ${i + 1}` } : r));
