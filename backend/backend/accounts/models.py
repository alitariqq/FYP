from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager

ROLES=(
    ('user','User'),
    ('admin','Admin')
)

class UserManager(BaseUserManager):
    def create_user(self, username, password=None, email=None, role='user'): #password=None for ease of migration, standard practice in BaseUserManager
        #Creates and saves regular user, email is nullable for admin accounts, however for regular users, should be mandated by the frontend
        if not username:
            raise ValueError("Users must have a username")
        user = self.model(username=username, email=email, role=role)
        user.set_password(password) #Stores the automatically hashed passwords
        user.save(using=self._db)
        return user

class User(AbstractBaseUser):
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    role = models.CharField(max_length=6, choices=ROLES, default='user')
    created_at = models.DateTimeField(auto_now_add=True)
    objects = UserManager()

    USERNAME_FIELD = 'username'  # login will be by username
    REQUIRED_FIELDS = []          

    def __str__(self):
        return self.username