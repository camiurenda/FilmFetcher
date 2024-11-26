const mongoose = require('mongoose');

/**
 * Esquema para configuración de programación de scraping
 */
const ScrapingScheduleSchema = new mongoose.Schema({
    // Referencia al sitio
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

    // Tipo de frecuencia
    tipoFrecuencia: {
        type: String,
        enum: {
            values: ['unica', 'diaria', 'semanal', 'mensual-dia', 'mensual-posicion'],
            message: '{VALUE} no es un tipo de frecuencia válido'
        },
        required: [true, 'El tipo de frecuencia es requerido']
    },

    // Configuración de hora (común para todos los tipos)
    hora: {
        type: String,
        required: [true, 'La hora es requerida'],
        validate: {
            validator: function(v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Hora debe estar en formato HH:mm'
        }
    },

    // Campos específicos según el tipo de frecuencia
    diasSemana: {
        type: [Number],
        validate: {
            validator: function(v) {
                if (this.tipoFrecuencia !== 'semanal') return true;
                return Array.isArray(v) && v.length > 0 && 
                       v.every(dia => dia >= 0 && dia <= 6);
            },
            message: 'Para frecuencia semanal, debe seleccionar al menos un día válido (0-6)'
        }
    },

    diaMes: {
        type: Number,
        validate: {
            validator: function(v) {
                if (this.tipoFrecuencia !== 'mensual-dia') return true;
                return v >= 1 && v <= 31;
            },
            message: 'El día del mes debe estar entre 1 y 31'
        }
    },

    semanaMes: {
        type: String,
        enum: {
            values: ['primera', 'segunda', 'tercera', 'cuarta', 'ultima'],
            message: '{VALUE} no es una semana del mes válida'
        },
        validate: {
            validator: function(v) {
                return this.tipoFrecuencia !== 'mensual-posicion' || v;
            },
            message: 'Semana del mes requerida para frecuencia mensual por posición'
        }
    },

    diaSemana: {
        type: Number,
        validate: {
            validator: function(v) {
                if (this.tipoFrecuencia !== 'mensual-posicion') return true;
                return v >= 0 && v <= 6;
            },
            message: 'Día de la semana debe estar entre 0 y 6'
        }
    },

    // Estado del job
    activo: {
        type: Boolean,
        default: true
    },

    // Flag para scraping inmediato
    scrapingInmediato: {
        type: Boolean,
        default: false
    },

    // Próxima ejecución programada
    proximaEjecucion: {
        type: Date,
        required: [true, 'La próxima ejecución es requerida'],
        validate: {
            validator: function(v) {
                return v instanceof Date && !isNaN(v);
            },
            message: 'Fecha de próxima ejecución inválida'
        }
    },

    // Última ejecución realizada
    ultimaEjecucion: {
        type: Date
    },

    // Fecha de creación
    fechaCreacion: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    strict: true
});

// Índices para optimizar queries frecuentes
ScrapingScheduleSchema.index({ sitioId: 1, activo: 1 });
ScrapingScheduleSchema.index({ proximaEjecucion: 1 });
ScrapingScheduleSchema.index({ 'tipoFrecuencia': 1, 'activo': 1 });

/**
 * Middleware para validación pre-save
 */
ScrapingScheduleSchema.pre('save', function(next) {
    // Validar que los campos requeridos según el tipo de frecuencia estén presentes
    switch (this.tipoFrecuencia) {
        case 'semanal':
            if (!this.diasSemana || !this.diasSemana.length) {
                return next(new Error('Días de la semana son requeridos para frecuencia semanal'));
            }
            break;
        case 'mensual-dia':
            if (!this.diaMes) {
                return next(new Error('Día del mes es requerido para frecuencia mensual por día'));
            }
            break;
        case 'mensual-posicion':
            if (!this.semanaMes || !this.diaSemana) {
                return next(new Error('Semana y día son requeridos para frecuencia mensual por posición'));
            }
            break;
    }

    // Asegurar que proximaEjecucion sea una fecha válida
    if (!this.proximaEjecucion || isNaN(this.proximaEjecucion)) {
        console.error('Próxima ejecución inválida en pre-save');
        return next(new Error('Fecha de próxima ejecución inválida'));
    }

    next();
});

/**
 * Middleware para logging
 */
ScrapingScheduleSchema.pre('save', function(next) {
    console.log('Pre-save ScrapingSchedule:', {
        id: this._id,
        sitioId: this.sitioId,
        tipoFrecuencia: this.tipoFrecuencia,
        proximaEjecucion: this.proximaEjecucion
    });
    next();
});

/**
 * Método virtual para obtener el estado actual
 */
ScrapingScheduleSchema.virtual('estado').get(function() {
    if (!this.activo) return 'inactivo';
    const ahora = new Date();
    if (this.ultimaEjecucion && this.ultimaEjecucion > ahora) return 'ejecutando';
    return 'programado';
});

/**
 * Método para verificar si es momento de ejecutar
 */
ScrapingScheduleSchema.methods.debeEjecutarse = function() {
    const ahora = new Date();
    return this.activo && this.proximaEjecucion <= ahora;
};

// Crear el modelo
const ScrapingSchedule = mongoose.model('ScrapingSchedule', ScrapingScheduleSchema);

/**
 * Función para validar la conexión con la colección al iniciar
 */
async function validarColeccion() {
    try {
        await ScrapingSchedule.countDocuments();
        console.log('Colección ScrapingSchedule validada correctamente');
    } catch (error) {
        console.error('Error al validar colección ScrapingSchedule:', error);
    }
}

validarColeccion();

module.exports = ScrapingSchedule;