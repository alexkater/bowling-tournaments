# Domain Conventions

## Estado de un Torneo
```
draft → published → in_progress → completed
                  ↘ cancelled
```
- `draft`: solo el organizador lo ve. Se puede editar todo.
- `published`: visible para jugadores. Se puede registrar. No se pueden cambiar fechas ni formato.
- `in_progress`: el torneo está corriendo. No se pueden registrar nuevos jugadores. Se pueden ingresar scores.
- `completed`: todas las puntuaciones ingresadas. Solo lectura.
- `cancelled`: torneo cancelado. No se puede reactivar.

## Estado de un Bracket
```
open → shuffling → in_progress → completed
```
- `open`: jugadores se están inscribiendo
- `shuffling`: organizador hizo shuffle, brackets generados
- `in_progress`: rondas en juego
- `completed`: bracket terminado, pagos calculados

## Handicap
- Base por defecto: 220
- Porcentaje por defecto: 80%
- Fórmula: `max(0, round((base - avg) * percentage / 100))`
- Handicap se calcula al momento de ingresar scores, no al registrarse
- Si el jugador no tiene average registrado, usar promedio del torneo o configurable

## Puntuaciones
- Cada juego: 0-300 (10 frames, 3 rolls máximo en frame 10)
- Roll individual: 0-10
- Cuando se ingresa un score, se asume juego completo (no roll-by-roll en MVP)
- Handicap se aplica por juego individual, no al total

## Pagos
- Precios en cents USD en la DB
- Smart payout con decaimiento geométrico:
  - 1st: 40% del prize pool
  - 2nd: 25%
  - 3rd: 15%
  - Resto: distribución decreciente hasta 5-10 posiciones
- Redondeo a $5/$10 más cercano
- El sobrante por redondeo va al fondo del torneo o se dona

## Tiebreakers
- `highest_game`: gana el que tenga el mejor juego individual
- `highest_series`: gana el que tenga la mejor serie de 2 juegos consecutivos
- `roll_off`: no computable vía software — marcar como tied y dejar que el organizador decida
- `shared`: premio compartido entre los empatados
