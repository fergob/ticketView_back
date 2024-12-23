import { Router } from "express";
import {
  getTickets,
  getTicketsAbiertos,
  resolverTicket,
  getTicketsCerrados,
  getTicketsResueltos,
  getTicketsEnCurso,
  getTicketsReabiertos,
  getTicketsPendientes,
  getTicketsRevision,
  getTicketsNuevos,
  areasReasignacion,
  reasignarTicket
} from "../controllers/ticket.controller.js";
import { verifyToken } from "../middleware/verifyToken.middleware.js";
import { verifyRole } from "../middleware/verifyRole.middleware.js";
import { checkResolutor } from "../middleware/checkResolutor.middleware.js";
import { checkIfUserActive } from "../middleware/checkIfUserActive.middleware.js";

const router = Router();

router.get("/tickets", verifyToken, getTicketsAbiertos);
router.get("/tickets/nuevos", verifyToken, getTicketsNuevos);
router.get("/tickets/en%20curso", verifyToken, getTicketsEnCurso);
router.get("/tickets/reabiertos", verifyToken, getTicketsReabiertos);
router.get("/tickets/pendientes", verifyToken, getTicketsPendientes);
router.get("/tickets/cerrados", verifyToken, getTicketsCerrados);
router.get("/tickets/resueltos", verifyToken, getTicketsResueltos);
router.get("/tickets/revision", verifyToken, getTicketsRevision);
router.put(
  "/reasignar",
  verifyToken,
  verifyRole(["Root", "Administrador", "Moderador"]),
  reasignarTicket
);
router.get("/reasignar/areas", verifyToken, areasReasignacion);
router.put("/resolver", verifyToken, checkResolutor, checkIfUserActive);

export default router;
