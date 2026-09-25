namespace Kotoba.Utility.Enums;

public enum SrsStage
{
    Locked = 0,
    Initiate = 1,      // In lesson queue / unlocked but unlearned
    Apprentice1 = 2,
    Apprentice2 = 3,
    Apprentice3 = 4,
    Apprentice4 = 5,
    Guru1 = 6,
    Guru2 = 7,
    Master = 8,
    Enlightened = 9,
    Burned = 10
}

public enum SubjectType
{
    Radical = 1,
    Kanji = 2,
    Vocabulary = 3
}

public enum DependencyType
{
    Component = 1,      // E.g. Radical is component of Kanji
    Prerequisite = 2,   // Generic prerequisite
    VocabularyKanji = 3,// Kanji is constituent of Vocabulary
    Related = 4
}

public enum ReviewType
{
    Meaning = 1,
    Reading = 2
}

public enum ReadingType
{
    Onyomi = 1,
    Kunyomi = 2,
    Nanori = 3,
    VocabularyReading = 4
}

public enum AiContentStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    NeedsReview = 4
}
