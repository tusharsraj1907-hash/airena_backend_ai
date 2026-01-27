import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHackathonDto } from './dto/create-hackathon.dto';
import { UpdateHackathonDto } from './dto/update-hackathon.dto';

@Injectable()
export class HackathonsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createDto: CreateHackathonDto) {
    const hackathon = await this.prisma.hackathon.create({
      data: {
        title: createDto.title,
        description: createDto.description || '',
        type: createDto.allowIndividual ? 'INDIVIDUAL' : 'TEAM',
        status: 'UPCOMING',
        minTeamSize: createDto.minTeamSize || 1,
        maxTeamSize: createDto.maxTeamSize || 5,
        startDate: new Date(createDto.startDate),
        endDate: new Date(createDto.endDate),
        registrationDeadline: createDto.registrationEnd ? new Date(createDto.registrationEnd) : null,
        organizerId: userId,
        bannerUrl: createDto.bannerImageUrl,
        location: createDto.venue,
        isVirtual: createDto.isVirtual || false,
        prizePool: createDto.prizeAmount ? `${createDto.prizeCurrency || 'USD'} ${createDto.prizeAmount}` : null,
      },
      include: {
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create problem statement tracks if provided
    if (createDto.problemStatementTracks && createDto.problemStatementTracks.length > 0) {
      await Promise.all(
        createDto.problemStatementTracks.map(track =>
          this.prisma.hackathonProblemStatement.create({
            data: {
              hackathonId: hackathon.id,
              uploadedById: userId,
              trackNumber: track.trackNumber,
              trackTitle: track.trackTitle,
              fileName: track.fileName,
              fileUrl: track.fileUrl,
              fileType: track.fileType,
              fileSize: track.fileSize,
              description: track.description,
            },
          })
        )
      );
    }

    return hackathon;
  }

  async findAll(filters?: { status?: string; category?: string; search?: string }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const hackathons = await this.prisma.hackathon.findMany({
      where,
      include: {
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            participants: true,
            teams: true,
            submissions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return hackathons;
  }

  async findOne(id: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        problemStatements: true,
        _count: {
          select: {
            participants: true,
            teams: true,
            submissions: true,
          },
        },
      },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    return hackathon;
  }

  async update(userId: string, id: string, updateDto: UpdateHackathonDto) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (hackathon.organizerId !== userId) {
      throw new ForbiddenException('You can only update your own hackathons');
    }

    const updated = await this.prisma.hackathon.update({
      where: { id },
      data: {
        ...(updateDto.title && { title: updateDto.title }),
        ...(updateDto.description && { description: updateDto.description }),
        ...(updateDto.startDate && { startDate: new Date(updateDto.startDate) }),
        ...(updateDto.endDate && { endDate: new Date(updateDto.endDate) }),
        ...(updateDto.bannerImageUrl !== undefined && { bannerUrl: updateDto.bannerImageUrl }),
        ...(updateDto.venue !== undefined && { location: updateDto.venue }),
        ...(updateDto.isVirtual !== undefined && { isVirtual: updateDto.isVirtual }),
      },
      include: {
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }

  async remove(userId: string, id: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (hackathon.organizerId !== userId) {
      throw new ForbiddenException('You can only delete your own hackathons');
    }

    await this.prisma.hackathon.delete({
      where: { id },
    });

    return { message: 'Hackathon deleted successfully' };
  }

  async publish(userId: string, id: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (hackathon.organizerId !== userId) {
      throw new ForbiddenException('You can only publish your own hackathons');
    }

    const updated = await this.prisma.hackathon.update({
      where: { id },
      data: { status: 'LIVE' },
      include: {
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }

  async registerForHackathon(
    userId: string,
    hackathonId: string,
    registrationData?: {
      teamName?: string;
      teamDescription?: string;
      teamMembers?: Array<{ name: string; email: string; role: string }>;
      selectedTrack?: number;
    },
  ) {
    console.log('🔄 Registration request:', { userId, hackathonId, registrationData });
    
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    // Check if already registered
    const existing = await this.prisma.hackathonParticipant.findUnique({
      where: {
        userId_hackathonId: {
          userId,
          hackathonId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('You are already registered for this hackathon');
    }

    // If team registration (check if teamName is provided and not empty)
    if (registrationData?.teamName && registrationData.teamName.trim()) {
      console.log('✅ Creating team:', registrationData.teamName);
      
      // Create team
      const team = await this.prisma.team.create({
        data: {
          name: registrationData.teamName,
          description: registrationData.teamDescription || '',
          hackathonId,
          leaderId: userId,
        },
      });

      console.log('✅ Team created:', team.id);

      // Create participant record for team leader
      const leaderParticipant = await this.prisma.hackathonParticipant.create({
        data: {
          userId,
          hackathonId,
          teamId: team.id,
          role: 'LEADER',
          selectedTrack: registrationData.selectedTrack,
        },
      });

      console.log('✅ Team leader participant created:', leaderParticipant.id);

      // Create participant records for team members
      // Note: In a real app, you'd send invitations and create participants when they accept
      // For now, we'll just store the emails in the team description or handle separately
      
      return {
        success: true,
        message: 'Successfully registered team for hackathon',
        participant: leaderParticipant,
        team,
      };
    }

    console.log('✅ Creating individual participant');
    
    // Individual registration
    const participant = await this.prisma.hackathonParticipant.create({
      data: {
        userId,
        hackathonId,
        role: 'MEMBER',
        selectedTrack: registrationData?.selectedTrack,
      },
      include: {
        hackathon: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    console.log('✅ Individual participant created:', participant.id);

    return {
      success: true,
      message: 'Successfully registered for hackathon',
      participant,
    };
  }

  async getMyHackathons(userId: string) {
    // Get hackathons where user is a participant
    const participations = await this.prisma.hackathonParticipant.findMany({
      where: { userId },
      include: {
        hackathon: {
          include: {
            organizer: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: {
                participants: true,
                teams: true,
                submissions: true,
              },
            },
          },
        },
      },
    });

    // Get user's submissions for these hackathons
    const hackathonIds = participations.map(p => p.hackathon.id);
    const userSubmissions = await this.prisma.submission.findMany({
      where: {
        hackathonId: { in: hackathonIds },
        participant: { userId },
      },
      include: {
        participant: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        files: true,
      },
    });

    // Map submissions to hackathons
    return participations.map(p => ({
      ...p.hackathon,
      submissions: userSubmissions
        .filter(s => s.hackathonId === p.hackathon.id)
        .map(s => ({
          ...s,
          submitter: s.participant?.user,
          isDraft: s.status === 'DRAFT',
          isFinal: s.status === 'SUBMITTED',
          submitterId: s.participant?.userId,
        })),
    }));
  }

  async getParticipants(hackathonId: string) {
    const participants = await this.prisma.hackathonParticipant.findMany({
      where: { hackathonId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Check if participant has submitted
    const participantsWithSubmission = await Promise.all(
      participants.map(async (participant) => {
        const submission = await this.prisma.submission.findFirst({
          where: {
            hackathonId,
            OR: [
              { participantId: participant.id },
              { teamId: participant.teamId },
            ],
          },
        });

        return {
          ...participant,
          hasSubmission: !!submission,
          submissionId: submission?.id || null,
        };
      }),
    );

    return participantsWithSubmission;
  }

  async updateStatus(userId: string, hackathonId: string, status: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (hackathon.organizerId !== userId) {
      throw new ForbiddenException('You can only update your own hackathons');
    }

    const updated = await this.prisma.hackathon.update({
      where: { id: hackathonId },
      data: { status: status as any },
      include: {
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }
}
