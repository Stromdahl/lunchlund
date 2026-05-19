import { Restaurant } from "../types";
import { scrapeElementorLunch } from "./elementor-lunch";

export function scrapeInspira(): Promise<Restaurant> {
  return scrapeElementorLunch({
    url: "https://restauranginspira.se/",
    name: "Restaurang & Café Inspira",
    address: "Scheelevägen 4, Lund",
  });
}
