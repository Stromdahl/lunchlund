import { Restaurant } from "../types";
import { scrapeElementorLunch } from "./elementor-lunch";

export function scrapeEdison(): Promise<Restaurant> {
  return scrapeElementorLunch({
    url: "https://restaurangedison.se/lunch/",
    name: "Restaurang Edison",
    address: "Emdalavägen 6B, Lund",
  });
}
