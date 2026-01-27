import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}
  
  async getHackathonStats(hackathonId: string) {
    return {
      totalParticipants: 0,
      totalSubmissions: 0,
      totalTeams: 0,
      submissionsByStatus: {},
    };
  }

  async getUserStats(userId: string) {
    return {
      totalUsers: 0,
      totalHackathons: 0,
      totalSubmissions: 0,
      totalWins: 0,
    };
  }

  async getPlatformStats() {
    try {
      console.log('🔄 Calculating platform statistics...');
      
      // Get all hackathons and filter active ones
      const allHackathons = await this.prisma.hackathon.findMany({
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      });
      
      // Calculate active hackathons (published and ongoing)
      const activeStatuses = ['PUBLISHED', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'SUBMISSION_OPEN', 'LIVE'];
      const activeHackathons = allHackathons.filter(h => activeStatuses.includes(h.status));
      
      // Get total submissions
      const totalSubmissions = await this.prisma.submission.count();
      
      // Get unique participants count
      const uniqueParticipants = await this.prisma.hackathonParticipant.findMany({
        select: {
          userId: true,
        },
        distinct: ['userId'],
      });
      
      const stats = {
        totalHackathons: allHackathons.length,
        activeHackathons: activeHackathons.length,
        totalParticipants: uniqueParticipants.length,
        totalSubmissions: totalSubmissions,
      };
      
      console.log('✅ Platform stats calculated:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ Error calculating platform stats:', error);
      return {
        totalHackathons: 0,
        activeHackathons: 0,
        totalParticipants: 0,
        totalSubmissions: 0,
      };
    }
  }
}