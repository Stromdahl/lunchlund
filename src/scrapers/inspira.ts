import { Restaurant } from "../types";
import { scrapeElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";

export function scrapeInspira(): Promise<Restaurant> {
  return scrapeElementorLunch({
    url: "https://restauranginspira.se/",
    name: "Restaurang & Café Inspira",
    address: "Scheelevägen 4, Lund",
    hours: weekdayLunch("11:30", "13:30"),
  });
}
