import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum VerificationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum DocumentType {
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  ID_CARD = 'id_card',
}

@Entity('verifications')
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  documentType: DocumentType;

  @Column({ type: 'json', nullable: true })
  documentData: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  documentImageUrl: string;

  @Column({ type: 'text', nullable: true })
  selfieImageUrl: string;

  @Column({ type: 'json', nullable: true })
  faceMatchResult: Record<string, any>;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'float', nullable: true })
  confidenceScore: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 