import { createLazyFileRoute } from "@tanstack/react-router";
import { CalculadoraPage } from "@/features/calculadora/CalculadoraPage";

export const Route = createLazyFileRoute("/_app/calculadora")({
  component: CalculadoraPage,
});