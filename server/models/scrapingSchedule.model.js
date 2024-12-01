const mongoose = require('mongoose');
const moment = require('moment');

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
        enum: ['diaria', 'semanal', 'mensual-dia', 'mensual-posicion', 'test'],
        required: true
    },

    configuraciones: [{
        hora: {
            type: String,
            required: true,
            validate: {
                validator: function(v) {
                    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                },
                message: props => `${props.value} no es una hora válida. Debe estar en formato HH:mm`
            }
        },
        diasSemana: [Number],
        diasMes: [Number],
        semanaMes: String,
        diaSemana: Number,
        descripcion: String
    }],

    activo: {
        type: Boolean,
        default: true
    },

    proximaEjecucion: {
        type: Date,
        required: true
    },

    ultimaEjecucion: {
        type: Date
    },

    intentosFallidos: {
        type: Number,
        default: 0
    },

    ultimoError: {
        mensaje: String,
        fecha: Date,
        intentos: Number
    },

    bloqueo: {
        bloqueado: Boolean,
        razon: String,
        fechaBloqueo: Date
    },

    tags: [String],
    
    prioridad: {
        type: Number,
        min: 1,
        max: 10,
        default: 1
    },

    fechaInicio: Date,
    fechaFin: Date,

    fechaCreacion: {
        type: Date,
        default: Date.now
    }
});

ScrapingScheduleSchema.methods.calcularProximaEjecucion = function(desde = new Date()) {
    console.log('Calculando próxima ejecución para schedule:', this._id);
    console.log('Configuraciones:', JSON.stringify(this.configuraciones, null, 2));
    
    if (!this.configuraciones || this.configuraciones.length === 0) {
        console.log('No hay configuraciones definidas');
        return null;
    }

    const ahora = moment(desde);
    let proximaEjecucion = null;

    for (const config of this.configuraciones) {
        console.log('Procesando configuración:', config);
        
        const [horas, minutos] = config.hora.split(':').map(Number);
        let fecha = moment(ahora).hour(horas).minute(minutos).second(0);

        // Si la fecha calculada es menor que ahora, ajustar según frecuencia
        if (fecha.isSameOrBefore(ahora)) {
            switch (this.tipoFrecuencia) {
                case 'diaria':
                    fecha.add(1, 'day');
                    break;

                case 'semanal':
                    if (!config.diasSemana || config.diasSemana.length === 0) {
                        console.log('No hay días de semana configurados');
                        continue;
                    }
                    
                    let encontrado = false;
                    let intentos = 0;
                    const diasOrdenados = [...config.diasSemana].sort((a, b) => a - b);
                    
                    while (!encontrado && intentos < 8) {
                        fecha.add(1, 'day');
                        if (diasOrdenados.includes(fecha.day())) {
                            encontrado = true;
                        }
                        intentos++;
                    }
                    
                    if (!encontrado) {
                        console.log('No se encontró un día válido en la semana');
                        continue;
                    }
                    break;

                case 'mensual-dia':
                    if (!config.diasMes || config.diasMes.length === 0) {
                        console.log('No hay días del mes configurados');
                        continue;
                    }
                    
                    let diaEncontrado = false;
                    for (const dia of config.diasMes.sort((a, b) => a - b)) {
                        const fechaPrueba = moment(fecha).date(dia);
                        if (fechaPrueba.isAfter(ahora)) {
                            fecha = fechaPrueba;
                            diaEncontrado = true;
                            break;
                        }
                    }
                    
                    if (!diaEncontrado) {
                        fecha.add(1, 'month').date(config.diasMes[0]);
                    }
                    break;

                case 'test':
                    fecha = moment(ahora).add(1, 'minute');
                    break;
            }
        }

        if (!proximaEjecucion || fecha.isBefore(proximaEjecucion)) {
            proximaEjecucion = fecha;
        }
    }

    console.log('Próxima ejecución calculada:', proximaEjecucion?.format());
    return proximaEjecucion?.toDate();
};

ScrapingScheduleSchema.pre('save', function(next) {
    console.log('Pre-save hook ejecutándose para schedule:', this._id);
    
    try {
        if (this.isModified('configuraciones') || this.isModified('tipoFrecuencia') || !this.proximaEjecucion) {
            const nuevaProximaEjecucion = this.calcularProximaEjecucion();
            if (!nuevaProximaEjecucion) {
                throw new Error('No se pudo calcular la próxima ejecución');
            }
            this.proximaEjecucion = nuevaProximaEjecucion;
        }
        
        next();
    } catch (error) {
        console.error('Error en pre-save de ScrapingSchedule:', error);
        next(error);
    }
});

module.exports = mongoose.model('ScrapingSchedule', ScrapingScheduleSchema);