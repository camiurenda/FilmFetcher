const mongoose = require('mongoose');

const horarioSchema = new mongoose.Schema({
    hora: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                if (!v) return false;
                const match = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/.exec(v);
                if (!match) return false;
                const hours = parseInt(match[1], 10);
                const minutes = parseInt(match[2], 10);
                return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
            },
            message: props => `${props.value} no es una hora válida. Debe estar en formato HH:mm (24 horas)`
        }
    },
    descripcion: {
        type: String,
        trim: true,
        maxlength: [200, 'La descripción no puede exceder los 200 caracteres']
    },
    diasSemana: {
        type: [Number],
        validate: {
            validator: function(v) {
                return Array.isArray(v) && v.every(dia => dia >= 0 && dia <= 6);
            },
            message: 'Días de la semana deben ser números entre 0 y 6'
        }
    },
    diasMes: {
        type: [Number],
        validate: {
            validator: function(v) {
                return Array.isArray(v) && v.every(dia => dia >= 1 && dia <= 31);
            },
            message: 'Días del mes deben ser números entre 1 y 31'
        }
    },
    semanaMes: {
        type: String,
        enum: ['primera', 'segunda', 'tercera', 'cuarta', 'ultima']
    },
    diaSemana: {
        type: Number,
        min: 0,
        max: 6
    }
});

const ScrapingScheduleSchema = new mongoose.Schema({
    sitioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sites',
        required: [true, 'El sitioId es requerido'],
        validate: {
            validator: async function(v) {
                try {
                    const Site = mongoose.model('Sites');
                    const site = await Site.findById(v);
                    return site !== null;
                } catch (error) {
                    console.error('Error en validación de sitioId:', error);
                    return false;
                }
            },
            message: 'El sitio especificado no existe'
        }
    },

    tipoFrecuencia: {
        type: String,
        enum: {
            values: ['diaria', 'semanal', 'mensual-dia', 'mensual-posicion', 'test'],
            message: '{VALUE} no es un tipo de frecuencia válido'
        },
        required: [true, 'El tipo de frecuencia es requerido']
    },

    prioridad: {
        type: Number,
        default: 1,
        min: [1, 'La prioridad mínima es 1'],
        max: [10, 'La prioridad máxima es 10']
    },

    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],

    configuraciones: [horarioSchema],

    activo: {
        type: Boolean,
        default: true
    },

    scrapingInmediato: {
        type: Boolean,
        default: false
    },

    proximaEjecucion: {
        type: Date,
        required: [true, 'La próxima ejecución es requerida']
    },

    ultimaEjecucion: {
        type: Date
    },

    ultimoError: {
        mensaje: String,
        fecha: Date,
        intentos: {
            type: Number,
            default: 0
        }
    },

    bloqueo: {
        bloqueado: {
            type: Boolean,
            default: false
        },
        fechaBloqueo: Date,
        razon: String
    },

    fechaCreacion: {
        type: Date,
        default: Date.now
    },

    fechaInicio: {
        type: Date
    },

    fechaFin: {
        type: Date
    }
}, {
    timestamps: true
});

// Índices
ScrapingScheduleSchema.index({ sitioId: 1, activo: 1 });
ScrapingScheduleSchema.index({ proximaEjecucion: 1, prioridad: -1 });
ScrapingScheduleSchema.index({ tags: 1 });

// Middleware de validación y cálculo de próxima ejecución
ScrapingScheduleSchema.pre('save', async function(next) {
    // Si es un documento nuevo o se modificaron las configuraciones/frecuencia
    if (this.isNew || this.isModified('configuraciones') || this.isModified('tipoFrecuencia')) {
        if (!this.configuraciones || this.configuraciones.length === 0) {
            return next(new Error('Debe especificar al menos una configuración de horario'));
        }

        // Validar que cada configuración tenga los campos necesarios según el tipo de frecuencia
        for (const config of this.configuraciones) {
            switch (this.tipoFrecuencia) {
                case 'diaria':
                    if (!config.hora) {
                        return next(new Error('Hora requerida para frecuencia diaria'));
                    }
                    break;
                case 'semanal':
                    if (!config.hora || !config.diasSemana || config.diasSemana.length === 0) {
                        return next(new Error('Hora y días de la semana requeridos para frecuencia semanal'));
                    }
                    break;
                case 'mensual-dia':
                    if (!config.hora || !config.diasMes || config.diasMes.length === 0) {
                        return next(new Error('Hora y días del mes requeridos para frecuencia mensual por día'));
                    }
                    break;
                case 'mensual-posicion':
                    if (!config.hora || !config.semanaMes || config.diaSemana === undefined) {
                        return next(new Error('Hora, semana del mes y día de la semana requeridos para frecuencia mensual por posición'));
                    }
                    break;
            }
        }

        // Validar fechas de inicio/fin si están presentes
        if (this.fechaInicio && this.fechaFin && this.fechaInicio > this.fechaFin) {
            return next(new Error('La fecha de inicio debe ser anterior a la fecha de fin'));
        }

        // Calcular próxima ejecución solo si no es scraping inmediato
        if (!this.scrapingInmediato) {
            // Usar la última ejecución como referencia si existe, sino usar la fecha actual
            const referencia = this.ultimaEjecucion || new Date();
            this.proximaEjecucion = this.calcularProximaEjecucion(referencia);
        }
    }

    next();
});

// Método para calcular la próxima ejecución
ScrapingScheduleSchema.methods.calcularProximaEjecucion = function(referencia = new Date()) {
    let proximaEjecucion = null;

    // Si está bloqueado, aplicar backoff exponencial
    if (this.bloqueo?.bloqueado) {
        const tiempoEspera = Math.min(
            Math.pow(2, this.ultimoError?.intentos || 0) * 60000, // Base: 1 minuto
            24 * 60 * 60000 // Máximo: 24 horas
        );
        return new Date(referencia.getTime() + tiempoEspera);
    }

    // Si es scraping inmediato, devolver la fecha actual
    if (this.scrapingInmediato) {
        return new Date();
    }

    for (const config of this.configuraciones) {
        const fechaEjecucion = this.calcularProximaEjecucionConfig(config, referencia);
        if (!proximaEjecucion || fechaEjecucion < proximaEjecucion) {
            proximaEjecucion = fechaEjecucion;
        }
    }

    return proximaEjecucion;
};

// Método para calcular la próxima ejecución de una configuración específica
ScrapingScheduleSchema.methods.calcularProximaEjecucionConfig = function(config, referencia) {
    const fecha = new Date(referencia);
    const [hora, minuto] = config.hora.split(':').map(Number);
    
    switch (this.tipoFrecuencia) {
        case 'diaria':
            fecha.setHours(hora, minuto, 0, 0);
            if (fecha <= referencia) {
                fecha.setDate(fecha.getDate() + 1);
            }
            break;

        case 'semanal':
            fecha.setHours(hora, minuto, 0, 0);
            while (!config.diasSemana.includes(fecha.getDay()) || fecha <= referencia) {
                fecha.setDate(fecha.getDate() + 1);
            }
            break;

        case 'mensual-dia':
            fecha.setHours(hora, minuto, 0, 0);
            let diaEncontrado = false;
            while (!diaEncontrado) {
                if (config.diasMes.includes(fecha.getDate()) && fecha > referencia) {
                    diaEncontrado = true;
                } else {
                    fecha.setDate(fecha.getDate() + 1);
                }
            }
            break;

        case 'mensual-posicion':
            fecha.setHours(hora, minuto, 0, 0);
            fecha.setDate(1);
            this.ajustarFechaPosicionMensual(fecha, config);
            if (fecha <= referencia) {
                fecha.setMonth(fecha.getMonth() + 1);
                fecha.setDate(1);
                this.ajustarFechaPosicionMensual(fecha, config);
            }
            break;

        case 'test':
            fecha.setMinutes(fecha.getMinutes() + 1);
            break;
    }

    // Validar contra fechaInicio y fechaFin si existen
    if (this.fechaInicio && fecha < this.fechaInicio) {
        fecha = new Date(this.fechaInicio);
    }
    if (this.fechaFin && fecha > this.fechaFin) {
        return null;
    }

    return fecha;
};

ScrapingScheduleSchema.methods.ajustarFechaPosicionMensual = function(fecha, config) {
    const posiciones = {
        'primera': 0,
        'segunda': 1,
        'tercera': 2,
        'cuarta': 3,
        'ultima': -1
    };

    if (config.semanaMes === 'ultima') {
        fecha.setMonth(fecha.getMonth() + 1, 0);
        while (fecha.getDay() !== config.diaSemana) {
            fecha.setDate(fecha.getDate() - 1);
        }
    } else {
        let semanaEncontrada = 0;
        while (semanaEncontrada <= posiciones[config.semanaMes]) {
            if (fecha.getDay() === config.diaSemana) {
                if (semanaEncontrada === posiciones[config.semanaMes]) break;
                semanaEncontrada++;
            }
            fecha.setDate(fecha.getDate() + 1);
        }
    }
};

const ScrapingSchedule = mongoose.model('ScrapingSchedule', ScrapingScheduleSchema);

module.exports = ScrapingSchedule;
