export interface Landmark { x: number; y: number; z: number }

export type GestureName =
  | 'None'
  | 'Closed_Fist'
  | 'Open_Palm'
  | 'Pointing_Up'
  | 'Thumb_Down'
  | 'Thumb_Up'
  | 'Victory'
  | 'ILoveYou';

export interface GestureGuess { name: GestureName; score: number }
