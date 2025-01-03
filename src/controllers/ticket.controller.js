import { TICKETS, ESTADOS, USUARIO } from "../models/index.js";
import { redisClient } from "../config/redis_connection.js";
import formateDate from "../functions/dateFormat.functions.js";
import mongoose from "mongoose";
import * as Gets from "../repository/gets.js";
import { postCrearTicket } from "../repository/posts.js";
import enviarCorreo from "../middleware/enviarCorreo.middleware.js";
import { putEditarTicket } from "../repository/puts.js";
import { addHours } from "date-fns";
const ObjectId = mongoose.Types.ObjectId;
export const getTickets = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  try {
    const results = await TICKETS.find().skip(skip).limit(limit);
    const total = await TICKETS.countDocuments();
    res.status(200).json({
      data: results,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener los datos" });
  }
};
//PENDIENTE DE MODIFICAR EL QUERY
//TODO no se usa
export const getTicketsAbiertos = async (req, res) => {
  const { collection } = req.query; // El nombre del estado enviado desde el cliente (ej. "abierto")
  const { Id, Rol, Coordinacion } = req.session.user; // ID del usuario autenticado
  try {
    const estadoDoc = await ESTADOS.findOne({ Estado: collection }); // Colección de estados
    if (!estadoDoc) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }

    const ticketsRolResolutor = async () => {
      const tickets = await TICKETS.find({
        Estado: estadoDoc._id,
        Asignado_final: Id,
        //$or: [{ Asignado_a: Id }, { Reasignado_a: Id }],
      })
        .populate("Tipo_incidencia", "Tipo_de_incidencia -_id")
        .populate("Area_asignado", "Area _id")
        .populate("Categoria", "Categoria -_id")
        .populate("Servicio", "Servicio -_id")
        .populate("Subcategoria", "Subcategoria -_id")
        .populate("Secretaria", "Secretaria -_id")
        .populate("Direccion_general", "Direccion_General -_id")
        .populate("Direccion_area", "direccion_area -_id")
        .populate("Prioridad", "Prioridad Descripcion -_id")
        .populate("Estado")
        .populate("Asignado_a", "Nombre Coordinacion")
        .populate("Reasignado_a", "Nombre Coordinacion")
        .populate("Resuelto_por", "Nombre Coordinacion")
        .populate("Creado_por", "Nombre -_id")
        .populate("Area_reasignado_a", "Area -_id")
        .populate("Cerrado_por", "Nombre Coordinacion -_id")
        .populate("Asignado_final", "Nombre Coordinacion");

      // Procesamos los resultados para definir el campo Asignado_a_final
      const data = tickets.map((ticket) => {
        return {
          ...ticket.toObject(),
          // Asignado_a_final:
          //   ticket.Asignado_a && ticket.Asignado_a._id === Id
          //     ? ticket.Asignado_a
          //     : ticket.Reasignado_a,
          Fecha_hora_creacion: formateDate(ticket.Fecha_hora_creacion),
          Fecha_limite_resolucion_SLA: formateDate(
            ticket.Fecha_limite_resolucion_SLA
          ),
          Fecha_hora_ultima_modificacion: formateDate(
            ticket.Fecha_hora_ultima_modificacion
          ),
          Fecha_hora_cierre: formateDate(ticket.Fecha_hora_cierre),
          Fecha_limite_respuesta_SLA: formateDate(
            ticket.Fecha_limite_respuesta_SLA
          ),
        };
      });

      return data;
    };

    const ticketsRolModerador = async () => {
      const tickets = await TICKETS.find({
        Estado: estadoDoc._id,
        Equipo_asignado: Coordinacion,
      })
        .populate("Tipo_incidencia", "Tipo_de_incidencia -_id")
        .populate("Area_asignado", "Area _id")
        .populate("Categoria", "Categoria -_id")
        .populate("Servicio", "Servicio -_id")
        .populate("Subcategoria", "Subcategoria -_id")
        .populate("Secretaria", "Secretaria -_id")
        .populate("Direccion_general", "Direccion_General -_id")
        .populate("Direccion_area", "direccion_area -_id")
        .populate("Prioridad", "Prioridad Descripcion -_id")
        .populate("Estado")
        .populate("Asignado_a", "Nombre Coordinacion")
        .populate("Reasignado_a", "Nombre Coordinacion")
        .populate("Resuelto_por", "Nombre Coordinacion")
        .populate("Creado_por", "Nombre -_id")
        .populate("Area_reasignado_a", "Area -_id")
        .populate("Cerrado_por", "Nombre Coordinacion -_id")
        .populate("Asignado_final", "Nombre Coordinacion");

      // Procesamos los resultados para definir el campo Asignado_a_final
      const data = tickets.map((ticket) => {
        return {
          ...ticket.toObject(),
          // Asignado_a_final:
          //   ticket.Asignado_a && ticket.Asignado_a._id === Id
          //     ? ticket.Asignado_a
          //     : ticket.Reasignado_a,
          Fecha_hora_creacion: formateDate(ticket.Fecha_hora_creacion),
          Fecha_limite_resolucion_SLA: formateDate(
            ticket.Fecha_limite_resolucion_SLA
          ),
          Fecha_hora_ultima_modificacion: formateDate(
            ticket.Fecha_hora_ultima_modificacion
          ),
          Fecha_hora_cierre: formateDate(ticket.Fecha_hora_cierre),
          Fecha_limite_respuesta_SLA: formateDate(
            ticket.Fecha_limite_respuesta_SLA
          ),
        };
      });
      return data;
    };

    let data;
    if (Rol === "Moderador") {
      data = await ticketsRolModerador();
    } else if (Rol === "Resolutor") {
      data = await ticketsRolResolutor();
    } else {
      return res.status(403).json({ message: "Rol no autorizado" });
    }

    // Enviamos la respuesta
    res.status(200).json(data);
  } catch (error) {
    console.error("Error al obtener los tickets:", error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
};

export const ticketsNuevos = async (req, res, next) => {
  const { userId } = req.session.user;
  try {
    const ESTADO = await Gets.getEstadoTicket("NUEVO");
    if (!ESTADO) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }
    const RES = await Gets.getTicketsNuevos(userId, ESTADO._id);
    if (!RES) {
      return res.status(500).json({ desc: "Error al obtener los tickets" });
    }
    req.tickets = RES;
    next();
  } catch (error) {
    console.error("Error al obtener los tickets:", error);
    return res.status(500).json({ message: "Error al obtener los datos" });
  }
};

export const ticketsEnCurso = async (req, res, next) => {
  const { userId } = req.session.user;
  try {
    const ESTADO = await Gets.getEstadoTicket("EN CURSO");
    if (!ESTADO) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }
    const RES = await Gets.getTicketsEnCurso(userId, ESTADO._id);
    if (RES === false) {
      return res.status(500).json({ desc: "Error al obtener los tickets" });
    }
    req.tickets = RES;
    next();
  } catch (error) {
    console.error("Error al obtener los tickets:", error);
    return res.status(500).json({ message: "Error al obtener los datos" });
  }
};

export const ticketsReabiertos = async (req, res, next) => {
  const { userId } = req.session.user;
  try {
    const ESTADO = await Gets.getEstadoTicket("REABIERTO");
    if (!ESTADO) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }
    const RES = await Gets.getTicketsReabiertos(userId, ESTADO._id);
    if (RES === false) {
      return res.status(500).json({ desc: "Error al obtener los tickets" });
    }
    req.tickets = RES;
    next();
  } catch (error) {
    console.error("Error al obtener los tickets:", error);
    return res.status(500).json({ message: "Error al obtener los datos" });
  }
};

export const ticketsPendientes = async (req, res, next) => {
  const { userId } = req.session.user;
  try {
    const ESTADO = await Gets.getEstadoTicket("PENDIENTE");
    if (!ESTADO) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }
    const RES = await Gets.getTicketsPendientes(userId, ESTADO._id);
    if (RES === false) {
      return res.status(500).json({ desc: "Error al obtener los tickets" });
    }
    req.tickets = RES;
    next();
  } catch (error) {
    console.error("Error al obtener los tickets:", error);
    return res.status(500).json({ message: "Error al obtener los datos" });
  }
};
//PENDIENTE DE MODIFICAR EL QUERY
export const ticketsRevision = async (req, res, next) => {
  const { areas } = req.session.user;
  try {
    const ESTADO = await Gets.getEstadoTicket("REVISIÓN");
    if (!ESTADO) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }
    const RES = await Gets.getTicketsRevision(ESTADO._id, areas);
    console.log(RES);
    if (RES === false) {
      return res.status(500).json({ desc: "Error al obtener los tickets" });
    }
    req.tickets = RES;
    next();
  } catch (error) {
    console.error("Error al obtener los tickets:", error);
    return res.status(500).json({ message: "Error al obtener los datos" });
  }
};
//PENDIENTE DE MODIFICAR EL QUERY
export const ticketsCerrados = async (req, res, next) => {
  const { userId, rol } = req.session.user;
  let resp;
  try {
    const ESTADO = await Gets.getEstadoTicket("CERRADO");
    if (!ESTADO) {
      return resp.status(404).json({ message: "Estado no encontrado" });
    }
    if (rol === "Usuario" || rol === "Moderador") {
      resp = await Gets.getTicketsCerradosForResolAndMod(userId, ESTADO._id);
      if (resp === false) {
        return res.status(500).json({ desc: "Error al obtener los tickets" });
      }
      req.tickets = resp;
      next();
    } else {
      resp = await Gets.getTicketsCerradosForAdmin(userId, ESTADO._id);
      if (resp === false) {
        return res.status(500).json({ desc: "Error al obtener los tickets" });
      }
      req.tickets = resp;
      next();
    }
  } catch (error) {
    console.error("Error al obtener los tickets:", error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
};

export const ticketsResueltos = async (req, res) => {
  const { userId, rol } = req.session.user;
  let resultado;
  try {
    const resuelto = await ESTADOS.findOne({ Estado: "RESUELTO" });
    if (!resuelto) {
      return res.status(404).json({ message: "Estado no encontrado" });
    }
    if (rol === "Usuario" || rol === "Moderador") {
      //resolutor
      resultado = await TICKETS.aggregate([
        {
          $match: {
            $and: [
              {
                Estado: resuelto._id,
              },
              { Resuelto_por: new ObjectId(userId) },
            ],
          },
        },
        {
          $addFields: {
            Asignado_final_a: {
              $cond: [
                {
                  $eq: ["$Resuelto_por", new ObjectId(userId)],
                },
                "$Resuelto_por",
                "$Resuelto_por",
              ],
            },
          },
        },
        {
          $project: {
            Asignado_final: 0,
          },
        },
      ]);
    } else {
      resultado = await TICKETS.aggregate([
        {
          $match: {
            $and: [
              { Estado: resuelto._id },
              { Creado_por: new ObjectId(userId) },
            ],
          },
        },
        {
          $addFields: {
            Asignado_final_a: {
              $cond: [
                {
                  $eq: ["$Resuelto_por", new ObjectId(userId)],
                },
                "$Resuelto_por",
                "$Resuelto_por",
              ],
            },
          },
        },
        {
          $project: {
            Asignado_final: 0,
          },
        },
      ]);
    }

    const ticketsConPopulate = await TICKETS.populate(resultado, [
      { path: "Tipo_incidencia", select: "Tipo_de_incidencia -_id" },
      { path: "Area_asignado", select: "Area _id" },
      { path: "Categoria", select: "Categoria -_id" },
      { path: "Servicio", select: "Servicio -_id" },
      { path: "Subcategoria", select: "Subcategoria -_id" },
      { path: "Secretaria", select: "Secretaria -_id" },
      { path: "Direccion_general", select: "Direccion_General -_id" },
      { path: "Direccion_area", select: "direccion_area -_id" },
      { path: "Prioridad", select: "Prioridad Descripcion -_id" },
      { path: "Estado" },
      { path: "Asignado_a", select: "Nombre Coordinacion" },
      { path: "Reasignado_a", select: "Nombre Coordinacion" },
      { path: "Resuelto_por", select: "Nombre Coordinacion" },
      { path: "Creado_por", select: "Nombre Coordinacion -_id" },
      { path: "Area_reasignado_a", select: "Area -_id" },
      { path: "Cerrado_por", select: "Nombre Coordinacion -_id" },
      { path: "Asignado_final_a", select: "Nombre Coordinacion" },
      {
        path: "Historia_ticket",
        populate: { path: "Nombre", select: "Nombre -_id" },
      },
    ]);
    const data = ticketsConPopulate.map((ticket) => {
      return {
        ...ticket,
        Fecha_hora_creacion: formateDate(ticket.Fecha_hora_creacion),
        Fecha_limite_resolucion_SLA: formateDate(
          ticket.Fecha_limite_resolucion_SLA
        ),
        Fecha_hora_ultima_modificacion: formateDate(
          ticket.Fecha_hora_ultima_modificacion
        ),
        Fecha_hora_cierre: formateDate(ticket.Fecha_hora_cierre),
        Fecha_limite_respuesta_SLA: formateDate(
          ticket.Fecha_limite_respuesta_SLA
        ),
        Historia_ticket: ticket.Historia_ticket
          ? ticket.Historia_ticket.map((historia) => ({
              Nombre: historia.Nombre,
              Mensaje: historia.Mensaje,
              Fecha: formateDate(historia.Fecha),
            }))
          : [],
      };
    });
    res.status(200).json(data);
  } catch (error) {
    console.error("Error al obtener los tickets:", error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
};

export const resolverTicket = async (req, res) => {
  const { _id, Descripcion_resolucion } = req.body;
  const { userId, rol, nombre } = req.session.user;
  let estado;
  try {
    if (rol != "Usuario") {
      [estado] = await ESTADOS.find({ Estado: "RESUELTO" });
    } else {
      [estado] = await ESTADOS.find({ Estado: "REVISIÓN" });
    }
    if (!estado) {
      return res
        .status(404)
        .json({ desc: "No se encontro el estado del ticket" });
    }
    const result = await TICKETS.findOneAndUpdate(
      { _id },
      {
        $set: {
          Estado: estado._id,
          Resuelto_por: userId,
          Respuesta_cierre_reasignado: Descripcion_resolucion,
        },
        $push: {
          Historia_ticket: {
            Nombre: userId,
            Mensaje:
              rol === "Usuario"
                ? `El ticket ha sido enviado a revisión por ${nombre}(${rol}). En espera de respuesta del moderador.\nDescripcion resolucion:\n${Descripcion_resolucion}`
                : `El ticket ha sido resuelto por ${nombre}(${rol}).`,
            Fecha: new Date(),
          },
        },
      }
    );
    if (result) {
      return res.status(200).json({
        desc: "El estado del ticket ha sido modificado exitosamente.",
      });
    } else {
      return res
        .status(500)
        .json({ desc: "Error al acutualizar el estado del ticket." });
    }
  } catch (error) {
    console.log(error);
  }
};

export const areasReasignacion = async (req, res) => {
  const { areas } = req.session.user;
  try {
    const AREAS = await Gets.getAreasParaReasignacion(areas);
    if (!AREAS) {
      return res.status(404).json({ desc: "No se encontraron áreas" });
    }
    const AREASRESOLUTORES = await Promise.all(
      AREAS.map(async (area) => {
        const RESOLUTOR = await Gets.getResolutoresParaReasignacionPorArea(
          area._id
        );
        return {
          area: area.Area,
          resolutores: RESOLUTOR,
        };
      })
    );
    if (!AREASRESOLUTORES) {
      return res.status(404).json({ desc: "No se encontraron resolutores" });
    }
    res.status(200).json({ AREASRESOLUTORES });
  } catch (error) {
    console.error("Error al obtener áreas y resolutores:", error);
    res.status(500).json({ message: "Error al obtener áreas y resolutores" });
  }
};
//TODO revisar
export const reasignarTicket = async (req, res, next) => {
  const { id_usuario_reasignar, id_ticket } = req.body;
  const { userId, nombre, rol, correo } = req.session.user;
  try {
    const user = await USUARIO.findOne({ _id: id_usuario_reasignar });
    if (!user) {
      return res
        .status(404)
        .json({ desc: "El usuario no fue encontrado en la BD." });
    }
    const Nombre_resolutor = user.Nombre; // a quien se va a reasignar
    const result = await TICKETS.findOneAndUpdate(
      { _id: id_ticket },
      {
        $set: {
          Area_reasignado_a: user.Area,
          Reasignado_a: id_usuario_reasignar,
        },
        $push: {
          Historia_ticket: {
            Nombre: userId,
            Mensaje: `El ticket ha sido reasignado a ${Nombre_resolutor} por ${nombre} - ${rol}`,
            Fecha: new Date(),
          },
        },
      },
      { returnDocument: "after", new: true }
    );
    if (result) {
      const correoData = {
        correo,
        correoResol: user.Correo,
        idTicket: result.Id,
        descripcionTicket: result.Descripcion,
        nombreCliente: result.Nombre_cliente,
        telefonoCliente: result.Telefono_cliente,
        dependenciaCliente: result.Dependencia_cliente,
      };
      req.channel = "channel_reasignarTicket";
      req.correoData = correoData;
      next();
    } else {
      res
        .status(500)
        .json({ desc: "Ocurrio un error al reasignar el ticket." });
    }
    next();
  } catch (error) {
    res.status(500).json({ desc: "Error en el servidor" });
    console.log(error);
  }
};

export const getInfoSelects = async (req, res) => {
  try {
    const RES = await Gets.getInfoSelectsCrearTicket();
    if (!RES) {
      return res.status(404).json({ desc: "No se encontró información" });
    }
    return res.status(200).json(RES);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Error fetching data" });
  }
};

export const cerrarTicket = async (req, res, next) => {
  const { _id, Descripcion_cierre, Causa } = req.body;
  const { userId, nombre, rol, correo } = req.session.user;

  try {
    const estado = await ESTADOS.findOneAndUpdate({ Estado: "CERRADO" });
    const result = await TICKETS.findOneAndUpdate(
      { _id },
      {
        $set: {
          Estado: estado._id,
          Cerrado_por: userId,
          Descripcion_cierre,
          Causa,
          Fecha_hora_cierre: new Date(),
        },
        $push: {
          Historia_ticket: {
            Nombre: userId,
            Mensaje: `El ticket fue cerrado por ${nombre}(${rol})`,
            Fecha: new Date(),
          },
        },
      },
      { returnDocument: "after", new: true }
    );
    if (result) {
      const correoData = {
        correo,
        idTicket: result.Id,
        descripcionTicket: result.Descripcion_cierre,
        correoCliente: result.Correo_cliente,
      };
      req.channel = "channel_cerrarTicket";
      req.correoData = correoData;
      next();
    } else {
      return res.status(500).json({ desc: "Error al cerrar el ticket." });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ desc: "Error interno en el servidor" });
  }
};
//FALTA AGREGAR AL REPOSITORIO (puts)
//TODO falta evaular la gravedad del ticket (limite_tiempo_respuesta)
export const reabrirTicket = async (req, res) => {
  const { _id, descripcion_reabrir, Area_asignado, Asignado_a } = req.body;
  const { Id, Rol, Nombre } = req.session.user;

  try {
    const [ticketAnterior] = await TICKETS.find({ _id });
    if (!ticketAnterior) {
      return res.status(404).json({ desc: "No se encontró el ticket" });
    }

    const {
      Estado: Estado_anterior,
      Area_asignado: Area_asignado_anterior,
      Asignado_a: Asignado_a_anterior,
      Area_reasignado_a: Area_reasignado_a_anterior,
      Reasignado_a: Reasignado_a_anterior,
      Descripcion: Descripcion_anterior,
      Causa: Causa_anterior,
      Prioridad: Prioridad_anterior,
      Fecha_hora_cierre: Fecha_hora_cierre_anterior,
      Respuesta_cierre_reasignado: Respuesta_cierre_reasignado_anterior,
      Resuelto_por: Resuelto_por_anterior,
    } = ticketAnterior;

    const estado = await ESTADOS.findOne({ Estado: "REABIERTO" });
    if (!estado) {
      return res
        .status(404)
        .json({ desc: "No se encontró el estado REABIERTO" });
    }

    const result = await TICKETS.updateOne(
      { _id },
      {
        $set: {
          Area_asignado,
          Asignado_a,
          Estado: estado._id,
          Descripcion: descripcion_reabrir,
        },
        $unset: {
          Area_reasignado_a: "",
          Reasignado_a: "",
          Causa: "",
          Prioridad: "",
          Fecha_limite_respuesta_SLA: "",
          Fecha_limite_resolucion_SLA: "",
          Fecha_hora_cierre: "",
          Respuesta_cierre_reasignado: "",
          Resuelto_por: "",
        },
        $push: {
          Historia_ticket: {
            Nombre: Id,
            Mensaje: `El ticket fue reabierto por ${Nombre}(${Rol})\n
                Descripción anterior:\n
                Estado anterior: ${Estado_anterior},\n
                Área asignada anterior: ${Area_asignado_anterior},\n
                Asignado anterior: ${Asignado_a_anterior},\n
                Área reasignada anterior: ${Area_reasignado_a_anterior},\n
                Reasignado anterior: ${Reasignado_a_anterior},\n
                Descripción anterior: ${Descripcion_anterior},\n
                Causa anterior: ${Causa_anterior},\n
                Prioridad anterior: ${Prioridad_anterior},\n
                Fecha de cierre anterior: ${Fecha_hora_cierre_anterior},\n
                Respuesta cierre reasignado anterior: ${Respuesta_cierre_reasignado_anterior},\n
                Resuelto por anterior: ${Resuelto_por_anterior}
                `,
            Fecha: new Date(),
          },
        },
      }
    );

    if (result.modifiedCount > 0) {
      return res.status(200).json({ desc: "El ticket fue reabierto" });
    } else {
      return res
        .status(500)
        .json({ desc: "Ocurrió un error al intentar reabrir el ticket" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ desc: "Error interno en el servidor" });
  }
};

export const aceptarResolucion = async (req, res) => {
  const { _id } = req.body;
  const { userId, nombre, rol } = req.session.user;
  try {
    const [estado] = await ESTADOS.find({ Estado: "RESUELTO" });
    if (!estado) {
      return res.status(404).json({ desc: "No se encontro el estado." });
    }
    const result = await TICKETS.updateOne(
      { _id },
      {
        $set: { Estado: estado._id },
        $push: {
          Historia_ticket: {
            Nombre: userId,
            Mensaje: `${nombre}(${rol}) ha aceptado la solucion del Resolutor. El estado del ticket es cambiado a "Resuelto" y se encuentra en espera de Cierre.`,
            Fecha: new Date(),
          },
        },
      }
    );
    if (result) {
      return res
        .status(200)
        .json({ desc: "El estado del ticket fue cambiado a Resuelto." });
    } else {
      return res.status(500).json({ desc: "Error al procesar la solicitud." });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ desc: "Error interno en el servidor." });
  }
};

export const rechazarResolucion = async (req, res) => {
  const { _id, motivo_rechazo } = req.body;
  const { userId, nombre, rol } = req.session.user;
  try {
    const [estado] = await ESTADOS.find({ Estado: "EN CURSO" });
    if (!estado) {
      return res.status(404).json({ desc: "No se encontro el estado." });
    }
    const result = await TICKETS.updateOne(
      { _id },
      {
        $set: {
          Estado: estado._id,
        },
        $unset: {
          Resuelto_por: "",
          Respuesta_cierre_reasignado: "",
        },
        $push: {
          Historia_ticket: {
            Nombre: userId,
            Mensaje: `${nombre}(${rol}) ha rechazado la solucion del Resolutor. El estado del ticket es cambiado a "Abierto". \nMotivo:\n${motivo_rechazo}`,
            Fecha: new Date(),
          },
        },
      }
    );
    if (result) {
      return res.status(200).json({
        desc: 'Se cambio el estado del ticket a "Abierto" y fue enviado al Resolutor.',
      });
    } else {
      return res
        .status(500)
        .json({ desc: "Error al cambiar el estado del ticket." });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ desc: "Error interno en el servidor." });
  }
};

export const crearTicket = async (req, res) => {
  const ticketNuevo = req.body;
  const { Id, Rol } = req.session.user;
  try {
    const nuevoTicket = new TICKETS({ ...ticketNuevo });
    redisClient.publish("channel_crearTicket", JSON.stringify(message));
  } catch (error) {
    console.log(error);
    res.status(500).json({ desc: "Error interno en el servidor" });
  }
};

export const obtenerAreas = async (req, res) => {
  try {
    const AREAS = await Gets.getAreas();
    console.log(AREAS);
    if (!AREAS) {
      return res.status(400).json({ desc: "No se encontraron areas" });
    }
    return res.status(200).json({ areas: AREAS, tickets: [] });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ desc: "Error interno en el servidor" });
  }
};

export const obtenerTicketsPorArea = async (req, res, next) => {
  const area = req.query.area;
  console.log("queries", req.query.area);
  try {
    const TICKETS = await Gets.getTicketsPorArea(area);
    if (!TICKETS) {
      return res.status(400).json({ desc: "No se encontraron areas." });
    }
    console.log(TICKETS);
    req.tickets = TICKETS;
    next();
  } catch (error) {
    console.error("Error al obtener los tickets:", error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
};

export const obtenerAreasModerador = async (req, res, next) => {
  const { Id, Area } = req.session.user;
  try {
    const AREAS = await Gets.getAreasModerador(Area);
    if (!AREAS) {
      return res.send(404).json({ desc: "No se encontrarón areas." });
    }
    return res.status(200).json({ areas: AREAS });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ desc: "Error interno en el servidor" });
  }
};

export const buscarTicket = async (req, res, next) => {
  const { id } = req.params;

  try {
    const RES = await Gets.getTicketPorID(id);
    if (!RES) {
      return res.status(404).json({ desc: "No se encontro el numero de ticket en la base de datos" });
    }
    req.tickets = RES;
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ desc: "Error interno en el servidor" });
  }
};

//TODO falta de agregar al repositorio (puts)
export const editTicket = async (req, res) => {
  const { userId, nombre, rol } = req.session.user; // Datos del usuario que edita
  const { ticketState } = req.body; // Datos actualizados del ticket
  if (!ticketState || !ticketState._id) {
    return res.status(400).json({
      error: "No se proporcionó el ID del ticket o el estado del ticket",
    });
  }
  const fechaActual = new Date();
  const ticketEditado = {
    _id: ticketState._id,
    Id: ticketState.Id,
    Prioridad: ticketState.Prioridad,
    Estado: ticketState.Estado,
    Tipo_de_incidencia: ticketState.Tipo_de_incidencia,
    NumeroRec_Oficio: ticketState.NumeroRec_Oficio,
    Numero_Oficio: ticketState.Numero_Oficio,
    PendingReason: ticketState.PendingReason,
    Servicio: ticketState.Servicio,
    Categoria: ticketState.Categoria,
    Subcategoria: ticketState.Subcategoria,
    Descripcion: ticketState.Descripcion,
    Secretaria: ticketState.Secretaria,
    Direccion_general: ticketState.Direccion_general,
    Direccion_area: ticketState.Direccion_area,
    Nombre_cliente: ticketState.Nombre_cliente,
    Telefono_cliente: ticketState.Telefono_cliente,
    Correo_cliente: ticketState.Correo_cliente,
  };
  try {
    // Buscar y actualizar el ticket
    const updatedTicket = await putEditarTicket(
      ticketEditado,
      userId,
      nombre,
      rol
    );

    if (!updatedTicket) {
      return res.status(404).json({ error: "Error al editar el ticket" });
    }

    res.status(200).json({
      desc: "Ticket actualizado correctamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar el ticket" });
  }
};

export const createTicket = async (req, res, next) => {
  if (!req.body.ticketState)
    return res.status(400).json({ desc: "No se envio informacion" });
  const fechaActual = new Date();
  const { userId, nombre, rol, correo } = req.session.user;
  const ticketState = JSON.parse(req.body.ticketState);
  const Asignado_a = ticketState.Asignado_a;
  //Se eliminan las propiedades que no se necesitan del objeto recibido
  let {
    _id: unused1,
    Id: unused2,
    Descripcion_mandar_a_Escritorio: unused3,
    Descripcion_cierre: unused4,
    Causa: unused5,
    Resuelto_por: unused6,
    Cerrado_por: unused7,
    Fecha_hora_cierre: unused8,
    Reasignado_a: unused9,
    Area_reasignado_a: unused10,
    Descripcion_resolucion: unused11,
    ...nuevoTicket
  } = ticketState;
  //Se agregan las propiedades necesarias al objeto
  nuevoTicket = {
    ...nuevoTicket,
    Fecha_hora_creacion: fechaActual,
    Fecha_limite_resolucion_SLA: addHours(fechaActual, ticketState.Fecha_limite_resolucion_SLA),
    Fecha_limite_respuesta_SLA:  addHours(fechaActual, ticketState.Fecha_limite_respuesta_SLA),
    Fecha_hora_ultima_modificacion: new Date("1900-01-01T18:51:03.980+00:00"),
    Fecha_hora_cierre: new Date("1900-01-01T18:51:03.980+00:00"),
    Creado_por: userId,
    Asignado_a,
    Area_asignado: new ObjectId("67350936aa438f58c6228fee"), //buscar el area
    Files: req.dataArchivo ? req.dataArchivo : "",
  };
  try {
    const RES = await postCrearTicket(nuevoTicket, userId, nombre, rol);
    if (!RES) {
      return res.status(500).json({ desc: "Error al guardar el ticket." });
    }
    const correoAsignado = await USUARIO.findOne({
      _id: RES.Asignado_a,
    });
    const correoData = {
      correo,
      idTicket: RES.Id,
      descripcionTicket: RES.Descripcion,
      correoCliente: RES.Correo_cliente,
      correoUsuario: correoAsignado.Correo,
      nombreCliente: RES.Nombre_cliente,
      telefonoCliente: RES.Telefono_cliente,
      dependenciaCliente: RES.Dependencia_cliente,
    };
    req.correoData = correoData;
    req.channel = "channel_crearTicket";
    console.log(req.correoData)
    console.log(req.channel)
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al guardar el ticket" });
  }
};
