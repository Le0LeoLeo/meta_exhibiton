import { createContext } from "react";

export const GalleryAtmosphereContext = createContext<"bright" | "spotlight" | "warm">("bright");
