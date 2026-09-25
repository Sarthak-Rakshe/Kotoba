using Microsoft.EntityFrameworkCore;
using Kotoba.DataAccess.Entities;

namespace Kotoba.DataAccess.Context;

public class KotobaDbContext : DbContext
{
    public KotobaDbContext(DbContextOptions<KotobaDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<Meaning> Meanings => Set<Meaning>();
    public DbSet<Reading> Readings => Set<Reading>();
    public DbSet<Mnemonic> Mnemonics => Set<Mnemonic>();
    public DbSet<ExampleSentence> ExampleSentences => Set<ExampleSentence>();
    public DbSet<SubjectDependency> SubjectDependencies => Set<SubjectDependency>();
    public DbSet<SrsItem> SrsItems => Set<SrsItem>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<AiGeneratedContent> AiGeneratedContents => Set<AiGeneratedContent>();
    public DbSet<Level> Levels => Set<Level>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.Email).IsUnique();
            entity.HasIndex(u => u.Username).IsUnique();
            entity.Property(u => u.Username).HasMaxLength(50).IsRequired();
            entity.Property(u => u.Email).HasMaxLength(256).IsRequired();
            entity.Property(u => u.PasswordHash).IsRequired();
        });

        // Subject
        modelBuilder.Entity<Subject>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.HasIndex(s => s.Type);
            entity.HasIndex(s => s.Level);
            entity.HasIndex(s => s.Character);
            entity.HasIndex(s => new { s.Level, s.LessonPosition });
            entity.Property(s => s.Character).HasMaxLength(100).IsRequired();
            entity.Property(s => s.MeaningHint).HasMaxLength(1000);
            entity.Property(s => s.ReadingHint).HasMaxLength(1000);

            entity.HasMany(s => s.Meanings)
                  .WithOne(m => m.Subject)
                  .HasForeignKey(m => m.SubjectId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(s => s.Readings)
                  .WithOne(r => r.Subject)
                  .HasForeignKey(r => r.SubjectId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(s => s.Mnemonics)
                  .WithOne(m => m.Subject)
                  .HasForeignKey(m => m.SubjectId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(s => s.ExampleSentences)
                  .WithOne(e => e.Subject)
                  .HasForeignKey(e => e.SubjectId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(s => s.ChildDependencies)
                  .WithOne(d => d.ParentSubject)
                  .HasForeignKey(d => d.ParentSubjectId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(s => s.ParentDependencies)
                  .WithOne(d => d.ChildSubject)
                  .HasForeignKey(d => d.ChildSubjectId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Subject Dependency
        modelBuilder.Entity<SubjectDependency>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.HasIndex(d => d.ParentSubjectId);
            entity.HasIndex(d => d.ChildSubjectId);
            entity.HasIndex(d => new { d.ParentSubjectId, d.ChildSubjectId }).IsUnique();
        });

        // SrsItem
        modelBuilder.Entity<SrsItem>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.HasIndex(s => new { s.UserId, s.SubjectId }).IsUnique();
            entity.HasIndex(s => new { s.UserId, s.AvailableAt });
            entity.HasIndex(s => new { s.UserId, s.Stage });

            entity.HasOne(s => s.User)
                  .WithMany(u => u.SrsItems)
                  .HasForeignKey(s => s.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.Subject)
                  .WithMany(sub => sub.SrsItems)
                  .HasForeignKey(s => s.SubjectId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Review
        modelBuilder.Entity<Review>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.HasIndex(r => new { r.UserId, r.ReviewedAt });
            entity.HasIndex(r => r.SubjectId);

            entity.HasOne(r => r.User)
                  .WithMany(u => u.Reviews)
                  .HasForeignKey(r => r.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.Subject)
                  .WithMany()
                  .HasForeignKey(r => r.SubjectId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(r => r.SrsItem)
                  .WithMany()
                  .HasForeignKey(r => r.SrsItemId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Level
        modelBuilder.Entity<Level>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.HasIndex(l => l.LevelNumber).IsUnique();
        });

        // AiGeneratedContent
        modelBuilder.Entity<AiGeneratedContent>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.HasIndex(a => a.Status);
            entity.HasIndex(a => a.SubjectType);
            entity.Property(a => a.TargetCharacter).HasMaxLength(50);
            entity.Property(a => a.Provider).HasMaxLength(50);
            entity.Property(a => a.Model).HasMaxLength(100);
        });
    }
}
